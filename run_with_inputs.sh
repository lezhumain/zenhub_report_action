#! /bin/bash

export INPUT_WORKSPACE_ID="582ffb92abc60d5d34359ef4"
#export INPUT_REPO_ID="93615076"
#export INPUT_REPO_ID="93615076,329683287"
export INPUT_REPO_ID=""
export INPUT_FROM_DATE="2024-06-06"
export INPUT_TO_DATE="2024-06-13"
export INPUT_FROM_PIPELINE="New Issues"
export INPUT_TO_PIPELINE="Awaiting STAGING Release"
export INPUT_RELEASE=""
export LABEL=""

node dist/index.js
