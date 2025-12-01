#!/bin/sh
set -eu

# Install n8n-observability from npm to node user's home
npm i --prefix /home/node n8n-observability

# Import the test workflow and capture its output to get the ID
echo "Importing workflow..."
set +e
IMPORT_OUTPUT=$(n8n import:workflow --input /workspace/workflow.json 2>&1)
IMPORT_EXIT=$?
set -e
echo "$IMPORT_OUTPUT"
if [ $IMPORT_EXIT -ne 0 ]; then
  echo "ERROR: Workflow import failed with exit code $IMPORT_EXIT"
  exit 1
fi

# List all workflows to find our specific one
echo "Listing workflows..."
n8n list:workflow > /tmp/workflow-list.txt || true
cat /tmp/workflow-list.txt

# Try to find the workflow by name "AI Assistant with Quality Checks"
# Export all workflows and search for our specific workflow name
n8n export:workflow --all --separate --output /tmp/exports

# Find the workflow file that contains our workflow name
WORKFLOW_FILE=$(grep -l "AI Assistant with Quality Checks" /tmp/exports/*.json 2>/dev/null | head -n1 || true)
if [ -z "$WORKFLOW_FILE" ]; then
  WORKFLOW_FILE=""
fi

if [ -n "$WORKFLOW_FILE" ]; then
  # Extract the ID from the specific workflow file
  ID=$(grep -o "\"id\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$WORKFLOW_FILE" | head -n1 | sed -E "s/.*\"([^\"]+)\"/\1/")
  echo "Found workflow ID from file: $ID"
else
  echo "Could not find workflow by name, trying to get the most recently imported workflow..."
  # Fall back to the first workflow ID found
  ID=$(find /tmp/exports -name "*.json" -exec grep -ho "\"id\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" {} \; | head -n1 | sed -E "s/.*\"([^\"]+)\"/\1/")
fi

if [ -z "$ID" ]; then
  echo "ERROR: Could not determine workflow ID"
  exit 1
else
  echo "Executing workflow with ID: $ID"
  n8n execute --id "$ID"
fi
