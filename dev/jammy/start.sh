#!/bin/sh
# Start the unmodified Xymon server and Apache, install the API from the
# clone mounted at /work with the UI beside it, feed the board, stay up.
set -u
H=/usr/lib/xymon/server
mkdir -p /run/xymon && chown xymon: /run/xymon

# The API: installed from a copy, as root, the way an admin would.
rm -rf /root/xp && cp -r /work/xymon-plugins /root/xp
git config --global --add safe.directory '*'
(cd /root/xp && XYMONHOME=$H ./install.sh install-server xymonapi) >/var/log/xymonapi-install.log 2>&1
sed -i '/DISABLED/d' /etc/xymon/tasks.d/xymonapi.cfg
# Reachable from the host, with one user: admin / admin. A test container only.
echo 'XYMONAPI_LISTEN="0.0.0.0:1986"' > /etc/xymon/xymonserver.d/xymonapi.cfg
htpasswd -b -B /etc/xymon/xymonpasswd admin admin >/dev/null 2>&1
chgrp xymon /etc/xymon/xymonpasswd; chmod 640 /etc/xymon/xymonpasswd
# The UI, live from the working tree.
ln -sfn /work/ui $H/ext/xymon-ui

# The package lets only the machine itself reach the classic pages; the
# test container's are opened to the host that runs it.
sed -i 's/Require local/Require all granted/' /etc/apache2/conf-available/xymon.conf
service xymon start >/dev/null 2>&1
service apache2 start >/dev/null 2>&1
sleep 5
/usr/local/bin/feed.sh
# Keep the statuses alive: they are valid for 30 minutes.
while :; do sleep 1200; /usr/local/bin/feed.sh; done
