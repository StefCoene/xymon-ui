# Ubuntu 22.04 with the distribution's own, unmodified Xymon server (4.3.30),
# Apache for its CGIs, and both ways of getting the API's Python modules:
# the distribution's packages (fastapi 0.63, uvicorn 0.15) and python3-venv.
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
        xymon xymon-client apache2 apache2-utils rrdtool curl ca-certificates \
        python3 python3-venv python3-pip python3-yaml python3-fastapi python3-uvicorn \
        procps less iproute2 git make shellcheck jq \
    && rm -rf /var/lib/apt/lists/*
RUN a2enmod cgi rewrite proxy proxy_http headers >/dev/null && a2enconf xymon >/dev/null || true
COPY hosts.cfg /etc/xymon/hosts.cfg
COPY start.sh feed.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/start.sh /usr/local/bin/feed.sh
EXPOSE 80 1986
CMD ["/usr/local/bin/start.sh"]
