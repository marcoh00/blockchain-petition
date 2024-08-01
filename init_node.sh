#!/bin/bash

set -e -x

NETWORK=${1:-localhost}
DEPLOY=${2:-YES}
ADDPETITIONS=${3:-YES}
STARTCLIENT=${4:-YES}
STARTIDPNAIVE=${5-YES}
STARTIDPZK=${6-YES}
STARTIDPPSSSECP256K1=${7-YES}
PIDS=""

sed -i 's/export const DEFAULT_NETWORK = NETWORKS.*/export const DEFAULT_NETWORK = NETWORKS.'"${NETWORK}"'/g' ${BASH_SOURCE%/*}/shared/addr.ts

pushd ${BASH_SOURCE%/*}/zk

if [ ! -f verification.key ] || [ ! -f proving.key ]; then
	zokrates compile -i stimmrechtsbeweis.zok
	zokrates setup
	zokrates export-verifier
	mv verifier.sol ../platform/contracts/StimmrechtsbeweisVerifier.sol
fi

popd

pushd ${BASH_SOURCE%/*}/pss

if [ ! -f secp256k1key.json ]; then
	pss-keygen -s 1 secp256k1key.json
fi

if [ ! -f ../platform/contracts/PssSecp256k1.sol ]; then
	cp -v ../pss-rs/pss-sol/src/PssSecp256k1.sol ../platform/contracts/PssSecp256k1.sol
fi

popd

pushd ${BASH_SOURCE%/*}/platform
yarn install
if [ ${NETWORK} = "localhost" ]
then
	npx hardhat node &
	PIDS="$! ${PIDS}"

	sleep 10
fi

if [ ${DEPLOY} = "YES" ]
then
	echo "Replace URL: ${IDPURL}"
	echo "Deploying contracts..."
	npx hardhat run --verbose --network ${NETWORK} scripts/deploy.ts
	echo "Contracts deployed"

	sleep 3
fi

if [ ${ADDPETITIONS} = "YES" ]
then
	echo "Creating test petitions..."
	npx hardhat run --verbose --network ${NETWORK} scripts/testpetitions.ts
	echo "Test petitions created"
fi

popd

function start_idp () {
	pushd ${BASH_SOURCE%/*}/idp
	yarn install
	npm run start -- --registry "$1" --database "${2:-$1.db}" --psskey "${3:-../pss/secp256k1key.json}" &
	PIDS="${PIDS} $!"
	popd
}

if [ ${STARTIDPNAIVE} = "YES" ]
then
	echo "Start Native IDP"
	start_idp "0x0165878A594ca255338adfa4d48449f69242Eb8F" "naive.db"
	echo "Native IDP started"
fi

if [ ${STARTIDPZK} = "YES" ]
then
	echo "Start ZK IDP"
	start_idp "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853" "zk.db"
	echo "ZK IDP started"
fi

if [ ${STARTIDPPSSSECP256K1} = "YES" ]
then
	echo "(Node) Compiling PSS library..."
	pushd ${BASH_SOURCE%/*}/pss-rs/pss-rs-wasm
	wasm-pack build -t nodejs -d pkg-node
	popd

	echo "Start PSS IDP"
	start_idp "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707" "pss.db"
	echo "PSS IDP started"
fi

if [ ${STARTCLIENT} = "YES" ]
then
	echo "(Web) Compiling PSS library..."
	pushd ${BASH_SOURCE%/*}/pss-rs/pss-rs-wasm
	wasm-pack build -t web -d pkg
	popd

	echo "Starting client..."
	pushd ${BASH_SOURCE%/*}/client
	yarn install
	npm run dev &
	PIDS="${PIDS} $!"
	echo "Client started"
	popd
fi

echo "[WAIT] [WAIT] [WAIT] [WAIT] [WAIT] [WAIT] [WAIT]"
wait $PIDS
