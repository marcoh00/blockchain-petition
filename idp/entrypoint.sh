#!/bin/bash

# Usage: entrypoint network dbfile nodeargs...

set -e -x

NETWORK=${1:-goerli}
DBFILE=${2:-/home/idp/database.db}

sed -i 's/exports.DEFAULT_NETWORK = exports.NETWORKS\..*;/exports.DEFAULT_NETWORK = exports.NETWORKS.'"${NETWORK}"';/g' dist/shared/addr.js
sed -i 's#exports.DBFILE = ".*#exports.DBFILE = "'"${DBFILE}"'";#g' dist/shared/addr.js

exec /usr/bin/node "${@:3}"