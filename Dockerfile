FROM rust:1.76 AS rustbuilder

RUN apt-get update && apt-get install -y binaryen && cargo install wasm-pack

WORKDIR /usr/src/myapp

COPY ./ZoKrates ZoKrates
COPY ./pss-rs pss-rs

RUN cd pss-rs && \
    cargo build --release && \
    cd pss-rs-wasm && \
    wasm-pack build -t web -d pkg && \
    wasm-pack build -t nodejs -d pkg-node && \
    cd ../..

RUN cd ZoKrates && \
    cargo build --release && \
    cd zokrates_js && \
    wasm-pack build --out-name index --target web --release

FROM docker.io/node:lts AS nodebuilder

ARG http_proxy

RUN apt-get update && apt-get install -y binaryen

COPY . /build
COPY --from=rustbuilder /usr/local/cargo/bin/wasm-pack /usr/bin/wasm-pack
COPY --from=rustbuilder /usr/src/myapp/ZoKrates/zokrates_stdlib/stdlib /root/.zokrates/stdlib
COPY --from=rustbuilder /usr/src/myapp/ZoKrates/target/release/zokrates /usr/bin/zokrates
COPY --from=rustbuilder /usr/src/myapp/ZoKrates/zokrates_js /build/ZoKrates/zokrates_js
COPY --from=rustbuilder /usr/src/myapp/pss-rs/pss-rs-wasm/pkg /build/pss-rs/pss-rs-wasm/pkg
COPY --from=rustbuilder /usr/src/myapp/pss-rs/pss-rs-wasm/pkg-node /build/pss-rs/pss-rs-wasm/pkg-node
COPY --from=rustbuilder /usr/src/myapp/pss-rs/target/release/pss-keygen /usr/bin/pss-keygen

RUN if [[ ! -z $http_proxy ]]; then echo "http_proxy={${http_proxy}}, https_proxy={${https_proxy}}" && \
    yarn config set proxy ${http_proxy} && \
    yarn config set https-proxy ${http_proxy} ; else echo "no proxy configured" ; fi

RUN echo "--- generate default pss keys ---" && \
    cd /build/pss && \
    pss-keygen -a secp256k1 -s 1 secp256k1key.json && \
    echo "--- zokrates compile ---" && \
    cd /build/zk && \
    zokrates compile -i stimmrechtsbeweis.zok && \
    echo "--- zokrates setup ---" && \
    zokrates setup && \
    echo "--- zokrates verifier ---" && \
    zokrates export-verifier && \
    mv verifier.sol ../platform/contracts/StimmrechtsbeweisVerifier.sol && \
    echo "--- pss256k1verifier ---" && \
    cp -v ../pss-rs/pss-sol/src/PssSecp256k1.sol ../platform/contracts/PssSecp256k1.sol

RUN echo "--- yarn install zokrates ---" && \
    cd /build/ZoKrates/zokrates_js && \
    # wasm-pack dependency will always want to download wasm-pack binary w/o proxy and fail
    yarn install --ignore-scripts && \
    echo "--- zokrates: npm patch ---" && \
    # Recent versions of wasm-pack specify 'main' instead of 'module' in their package.json which causes the patch to fail
    sed -i 's/packageObject.module/packageObject.main/' patch.js && \
    npm run patch && \
    echo "--- zokrates: npm bundle ---" && \
    npm run bundle && \
    echo "--- yarn install shared ---" && \
    cd /build/shared && yarn install && \
    echo "--- yarn install hardhat & compile ---" && \
    cd /build/platform && yarn install && npx hardhat compile && \
    echo "--- yarn install idp ---" && \
    cd /build/idp && yarn install && \
    echo "--- tsc idp ---" && \
    npx tsc -p /build/idp/tsconfig.json && \
    echo "--- yarn install client ---" && \
    cd /build/client && yarn install && \
    echo "--- webpack client ---" && \
    npx webpack

FROM docker.io/node:lts AS idp

RUN useradd -u 1001 -m -s /usr/sbin/nologin idp
COPY --from=nodebuilder /build/idp /home/idp/idp
COPY --from=nodebuilder /build/pss /home/idp/pss
COPY --from=nodebuilder /build/zk /home/idp/zk

RUN chown -R idp:idp /home/idp && chmod u+x /home/idp/idp/entrypoint.sh

WORKDIR /home/idp/idp

ENTRYPOINT [ "/home/idp/idp/entrypoint.sh" ]

FROM docker.io/node:lts AS hardhat

RUN useradd -u 1001 -m -s /usr/sbin/nologin hardhat
COPY --from=nodebuilder /build/platform /home/hardhat/platform
COPY --from=nodebuilder /build/pss /home/hardhat/pss
COPY --from=nodebuilder /build/zk /home/hardhat/zk
RUN chown -R hardhat:hardhat /home/hardhat
WORKDIR /home/hardhat/platform
HEALTHCHECK --start-period=60s \
    CMD curl -f http://localhost:8545/ || exit 1
EXPOSE 8545
ENTRYPOINT [ "/usr/local/bin/npx", "hardhat" ]

FROM docker.io/nginx:stable AS webapp

COPY --from=nodebuilder /build/client/dist /usr/share/nginx/html
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
