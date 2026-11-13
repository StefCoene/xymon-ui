#!/bin/sh
# Build and (re)start the Ubuntu 22.04 test container.
#   UI and API:  http://127.0.0.1:11986/xymon/ui/   (admin / admin)
#   classic Xymon pages: http://127.0.0.1:18080/xymon/
here=`cd "\`dirname "$0"\`" && pwd`
root=`cd "$here/../.." && pwd`
docker build -q -t xymon-ui-jammy "$here" >/dev/null || exit 1
docker rm -f xui-jammy >/dev/null 2>&1
docker run -d --name xui-jammy -p 127.0.0.1:18080:80 -p 127.0.0.1:11986:1986 \
	-v "$root":/work xymon-ui-jammy >/dev/null || exit 1
echo "started: http://127.0.0.1:11986/xymon/ui/ (admin / admin)"
