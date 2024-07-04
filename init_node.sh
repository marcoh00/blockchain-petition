#!/bin/bash

set -e -x

NETWORK=${1:-localhost}
TYPE=${2:-zk}
ADDPETITIONS=${3:-YES}
DEPLOY=${4:-NO}
STARTIDP=${5-YES}
STARTCLIENT=${6:-YES}
IDPURL=${7:-http://localhost:65535}
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

pushd ${BASH_SOURCE%/*}/platform

if [ ${NETWORK} = "localhost" ]
then
	npx hardhat node &
	PIDS="$! ${PIDS}"

	sleep 10
fi

if [ ${DEPLOY} = "YES" ]
then
	echo "Replace URL: ${IDPURL}"
	sed -i 's#.*return.*// replace#return "'"${IDPURL}"'"; // replace#g' contracts/IDP.sol
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

if [ ${STARTIDP} = "YES" ]
then
	echo "Starting IDP..."
	pushd ${BASH_SOURCE%/*}/idp
	npm run start -- $TYPE &
	PIDS="${PIDS} $!"
	echo "IDP started"
	popd
fi

if [ ${STARTCLIENT} = "YES" ]
then
	echo "Starting client..."
	pushd ${BASH_SOURCE%/*}/client
	npm run dev &
	PIDS="${PIDS} $!"
	echo "Client started"
	popd
fi

echo "[WAIT] [WAIT] [WAIT] [WAIT] [WAIT] [WAIT] [WAIT]"
wait $PIDS
