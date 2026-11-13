#!/bin/sh
# Put a varied board on the test server: every colour, an acknowledged red,
# a disabled test, and RRD data through the standard la/disk/memory statuses.
X="/usr/lib/xymon/client/bin/xymon 127.0.0.1"
st() { $X "status+30m $1.$2 $3 `date` $4"; }
for h in web1 web2 db1 db2 app1 app2 app3 rtr1 rtr2 sw1 sw2; do
	H=`echo $h.example.com | tr . ,`
	st $H cpu green "up: 12 days, 1 users, 120 procs, load=0.4"
	st $H disk green "- Filesystems OK
Filesystem 1K-blocks Used Available Capacity Mounted on
/dev/sda1 41152736 10288184 28751304 27% /"
	st $H memory green "- Memory OK
   Memory       Used      Total  Percentage
&green Physical 2048M 8192M 25%
&green Swap 0M 2048M 0%"
	st $H procs green "All processes OK"
	st $H conn green "Host is up"
done
st web1,example,com http yellow "&yellow http://web1.example.com/ - slow answer: 4.2 s"
st web2,example,com http green "&green http://web2.example.com/ - OK"
st db1,example,com disk red "- Filesystems NOT ok
&red /var/lib/mysql (97% used) has reached the PANIC level (95%)"
st db2,example,com procs yellow "&yellow mysqld (found 0, req. 1 or more)"
st app2,example,com cpu red "&red Load is CRITICAL: load=18.2"
st app3,example,com msgs clear "No log files to check"
st rtr2,example,com conn red "&red rtr2.example.com does not answer ping"
st sw1,example,com ports yellow "&yellow port Gi0/12 is down"
sleep 2
# An acknowledged red and a disabled test.
cookie=`$X "xymondboard host=^app2.example.com$ test=^cpu$ fields=cookie"`
[ -n "$cookie" ] && $X "xymondack $cookie 60 known problem, working on it"
$X "disable sw2.example.com.conn 120 planned maintenance"
