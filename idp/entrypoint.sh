#!/bin/bash

set -e -x

exec node dist/idp/src/main.js "$@"
