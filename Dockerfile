FROM quay.io/fedora/fedora:37 AS builder

ARG BRANCH=main
ARG GITUSER=podmanBuildEthereumSeclab
ARG GITPASS

RUN     dnf up --refresh -y && dnf install -y git nodejs npm && dnf clean all && \
        mkdir -p /build && cd /build && \
        git clone -b ${BRANCH} https://${GITUSER}:${GITPASS}@git.fslab.de/mhuens2m/blocktechdiver-petitionen.git petitionen && \
        echo "--- npm install shared ---" && \
        cd  /build/petitionen/shared && npm install && \
        echo "--- npm install hardhat & compile ---" && \
        cd /build/petitionen/platform && npm install && npx hardhat compile && \
        echo "--- npm install idp ---" && \
        cd /build/petitionen/idp && npm install && \
        echo "--- tsc idp ---" && \
        npx tsc -p /build/petitionen/idp/tsconfig.json && \
        echo "--- npm install client ---" && \
        cd /build/petitionen/client && npm install && \
        echo "--- webpack client ---" && \
        npx webpack && \
        dnf remove -y git && dnf clean all

FROM builder AS idp

RUN     useradd -u 1001 -m -s /sbin/nologin idp && \
        cp -r /build/petitionen/idp/{dist,node_modules,entrypoint.sh} /home/idp && \
        cd /home/idp && chown -R idp:idp /home/idp && chmod u+x /home/idp/entrypoint.sh && rm -rf /build 

USER idp
WORKDIR /home/idp

EXPOSE 65535

ENTRYPOINT [ "/home/idp/entrypoint.sh" ]
CMD ["goerli", "/home/idp/database.db", "dist/idp/src/main.js"]

FROM docker.io/nginx:stable AS webapp

COPY --from=builder /build/petitionen/client/dist /usr/share/nginx/html
RUN     rm /etc/nginx/conf.d/default.conf && echo '\
server {\
    listen 80 default_server;\
    listen [::]:80 default_server;\
\
    types {\
        application/wasm         wasm;\
        application/javascript   js;\
        application/json         json;\
        text/html                html htm shtml;\
        application/xhtml+xml    xhtml;\
        application/octet-stream key;\
    }\
\
    location / {\
        root /usr/share/nginx/html;\
    }\
}\
' >> /etc/nginx/conf.d/app.conf