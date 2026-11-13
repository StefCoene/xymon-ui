# What the tests of xymon-plugins need: a compiler and Xymon's build
# dependencies, to build Xymon's main, and the Python the API runs with.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
        build-essential libc-ares-dev libldap-dev libpcre2-dev librrd-dev libssl-dev libtirpc-dev \
        rrdtool git curl ca-certificates apache2-utils openssl procps iproute2 shellcheck \
        python3 python3-venv python3-yaml python3-fastapi python3-uvicorn python3-httpx \
    && rm -rf /var/lib/apt/lists/*
