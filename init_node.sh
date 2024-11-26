#!/bin/bash

set -e -x

NETWORK=${1:-localhost}
DEPLOY=${2:-YES}
ADDPETITIONS=${3:-YES}
STARTCLIENT=${4:-YES}
STARTIDPNAIVE=${5-YES}
STARTIDPZK=${6-YES}
STARTIDPPSSSECP256K1=${7-YES}
STARTIDPPSSALTBN128=${8-YES}
STARTIDPSEMAPHORE=${9-YES}
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
	pss-keygen -s 1 -a secp256k1 secp256k1key.json
fi

if [ ! -f altbn128key.json ]; then
	pss-keygen -s 1 -a alt-bn128 altbn128key.json
fi

if [ ! -f ../platform/contracts/IPssVerifier.sol ]; then
	cp -v ../pss-rs/pss-sol/src/IPssVerifier.sol ../platform/contracts/IPssVerifier.sol
fi

if [ ! -f ../platform/contracts/PssSecp256k1.sol ]; then
	cp -v ../pss-rs/pss-sol/src/PssSecp256k1.sol ../platform/contracts/PssSecp256k1.sol
fi

if [ ! -f ../platform/contracts/PssAltBn128.sol ]; then
	cp -v ../pss-rs/pss-sol/src/Altbn128.sol ../platform/contracts/Altbn128.sol
	cp -v ../pss-rs/pss-sol/src/PssAltBn128.sol ../platform/contracts/PssAltBn128.sol
fi

popd

pushd ${BASH_SOURCE%/*}/shared
yarn install
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

if [ ${STARTIDPPSSSECP256K1} = "YES" ]
then
	echo "(Node) Compiling PSS library..."
	pushd ${BASH_SOURCE%/*}/pss-rs/pss-rs-wasm
	wasm-pack build -t nodejs -d pkg-node
	popd

	echo "Start PSS IDP"
	start_idp "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707" "pss.db" "../pss/secp256k1key.json"
	echo "PSS SECP256K1 IDP started"
fi

if [ ${STARTIDPPSSALTBN128} = "YES" ]
then
	echo "(Node) Compiling PSS library..."
	pushd ${BASH_SOURCE%/*}/pss-rs/pss-rs-wasm
	wasm-pack build -t nodejs -d pkg-node
	popd

	echo "Start PSS IDP"
	start_idp "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" "pssaltbn.db" "../pss/altbn128key.json"
	echo "PSS ALTBN128 IDP started"
fi

if [ ${STARTIDPNAIVE} = "YES" ]
then
	echo "Start Native IDP"
	start_idp "0x610178dA211FEF7D417bC0e6FeD39F05609AD788" "naive.db"
	echo "Native IDP started"
fi

if [ ${STARTIDPZK} = "YES" ]
then
	echo "Start ZK IDP"
	start_idp "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e" "zk.db"
	echo "ZK IDP started"
fi

if [ ${STARTIDPSEMAPHORE} = "YES" ]
then
	echo "Start Semaphore IDP"
	start_idp "0x9A676e781A523b5d0C0e43731313A708CB607508" "semaphore.db"
	echo "Semaphore IDP started"
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
