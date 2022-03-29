#!/bin/bash

set -e -x

pushd ${BASH_SOURCE%/*}/platform
npx hardhat node &
HHNODE=$!

sleep 10
npx hardhat run --network localhost scripts/deploy.ts
sleep 3
npx hardhat run --network localhost scripts/testpetitions.ts

popd

pushd ${BASH_SOURCE%/*}/idp
npm run start &
IDPNODE=$!
popd

pushd ${BASH_SOURCE%/*}/client
npm run dev &
CLIENTNODE=$!
popd



wait $HHNODE $IDPNODE $CLIENTNODE
