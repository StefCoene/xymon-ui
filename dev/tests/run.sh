#!/bin/sh
# Run the tests of xymon-plugins (the clone beside this repository) in a
# container: they need a built Xymon source tree, and a machine on which a
# connection to a closed local port is refused at once, which not every
# desktop is.
#
#   dev/tests/run.sh [XYMON_SOURCE] [TEST_DIR...]
#
# XYMON_SOURCE is a Xymon checkout to build, by default ../xymon beside this
# repository; it is cloned and built inside a volume, xymon-ui-src, kept
# between runs and rebuilt when the checkout's HEAD has moved. TEST_DIR is
# what the plugins' own runner takes: plugins/xymonapi/tests, tests/compat ...
# XYMON_PLUGINS names another copy of xymon-plugins to test.
here=`cd "\`dirname "$0"\`" && pwd`
root=`cd "$here/../.." && pwd`
src=${1:-$root/../xymon}
[ $# -gt 0 ] && shift
[ -d "$src/.git" ] || { echo "$src is not a Xymon checkout" >&2; exit 2; }
docker build -q -t xymon-ui-tests "$here" >/dev/null || exit 1
exec docker run --rm -v "${XYMON_PLUGINS:-$root/xymon-plugins}":/plugins:ro -v "`cd "$src" && pwd`":/xymon:ro \
	-v xymon-ui-src:/build -e XYMONAPI_NO_SKIP="${XYMONAPI_NO_SKIP:-}" xymon-ui-tests sh -c '
	set -e
	git config --global --add safe.directory "*"
	want=`git -C /xymon rev-parse HEAD`
	if [ "`cat /build/.built 2>/dev/null`" != "$want" ]; then
		rm -rf /build/xymon && git clone -q /xymon /build/xymon && cd /build/xymon
		sed -n "/USEXYMONPING=y/,/INSTALLWWWDIR=/p" .github/workflows/build.yml | sed "s/^ *//" > /build/conf.sh
		echo "./configure --server" >> /build/conf.sh
		CONFTYPE= sh /build/conf.sh >/build/configure.log 2>&1
		make -j`nproc` >/build/make.log 2>&1
		echo "$want" > /build/.built
		echo "built Xymon $want"
	fi
	# A copy the tests may write in, as a clone so that its version is found.
	rm -rf /tmp/plugins && cp -r /plugins /tmp/plugins && cd /tmp/plugins
	XYMON_SRC=/build/xymon tests/run.sh "$@"
' sh "$@"
