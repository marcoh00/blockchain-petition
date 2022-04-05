#!/bin/bash

set -e -x

NETWORK=${1:-localhost}
ADDPETITIONS=${2:-YES}
DEPLOY=${3:-NO}
PIDS=""

sed -i 's/export const DEFAULT_NETWORK = NETWORKS.*/export const DEFAULT_NETWORK = NETWORKS.'"${NETWORK}"'/g' ${BASH_SOURCE%/*}/shared/addr.ts

pushd ${BASH_SOURCE%/*}/platform

if [ ${NETWORK} = "localhost" ]
then
	npx hardhat node &
	PIDS="$! ${PIDS}"

	sleep 10
fi

if [ ${DEPLOY} = "YES" ]
then
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

echo "Starting IDP..."
pushd ${BASH_SOURCE%/*}/idp
npm run start &
PIDS="${PIDS} $!"
echo "IDP started"
popd

echo "Starting client..."
pushd ${BASH_SOURCE%/*}/client
npm run dev &
PIDS="${PIDS} $!"
echo "Client started"
popd

echo "[WAIT] [WAIT] [WAIT] [WAIT] [WAIT] [WAIT] [WAIT]"
wait $PIDS
