#!/bin/bash

# Fix imports script for lsp-client package reorganization

echo "Fixing import paths..."

# Function to fix imports in a directory
fix_imports_in_dir() {
    local dir=$1
    echo "Processing $dir..."
    
    find "$dir" -name "*.ts" -type f | while read -r file; do
        # Skip node_modules and dist
        if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]]; then
            continue
        fi
        
        # Create temp file
        temp_file=$(mktemp)
        
        # Fix imports
        sed -E \
            -e 's|from "\.\./lspClient"|from "../core/client-legacy"|g' \
            -e 's|from "\./lspClient"|from "./core/client-legacy"|g' \
            -e 's|from "\.\./lspTypes"|from "../protocol/types-legacy"|g' \
            -e 's|from "\./lspTypes"|from "./protocol/types-legacy"|g' \
            -e 's|from "\.\./protocol"|from "../protocol/parser"|g' \
            -e 's|from "\./protocol"|from "./protocol/parser"|g' \
            -e 's|from "\.\./requestManager"|from "../protocol/request-manager"|g' \
            -e 's|from "\./requestManager"|from "./protocol/request-manager"|g' \
            -e 's|from "\.\./lspValidator"|from "../validation/validator"|g' \
            -e 's|from "\./lspValidator"|from "./validation/validator"|g' \
            -e 's|from "\.\./lspTester"|from "../testing/tester"|g' \
            -e 's|from "\./lspTester"|from "./testing/tester"|g' \
            -e 's|from "\.\./testHelpers"|from "../testing/helpers"|g' \
            -e 's|from "\./testHelpers"|from "./testing/helpers"|g' \
            -e 's|from "\.\./lspProcessPool"|from "../process/pool"|g' \
            -e 's|from "\./lspProcessPool"|from "./process/pool"|g' \
            -e 's|from "\.\./lspAdapterUtils"|from "../adapters/utils"|g' \
            -e 's|from "\./lspAdapterUtils"|from "./adapters/utils"|g' \
            -e 's|from "\.\./documentManager"|from "../document/manager"|g' \
            -e 's|from "\./documentManager"|from "./document/manager"|g' \
            -e 's|from "\.\./diagnosticsManager"|from "../diagnostics/manager"|g' \
            -e 's|from "\./diagnosticsManager"|from "./diagnostics/manager"|g' \
            -e 's|from "\.\./diagnosticUtils"|from "../diagnostics/utils"|g' \
            -e 's|from "\./diagnosticUtils"|from "./diagnostics/utils"|g' \
            -e 's|from "\.\./workspaceEditHandler"|from "../workspace/edit-handler"|g' \
            -e 's|from "\./workspaceEditHandler"|from "./workspace/edit-handler"|g' \
            -e 's|from "\.\./globalClientManager"|from "../client/global-manager"|g' \
            -e 's|from "\./globalClientManager"|from "./client/global-manager"|g' \
            -e 's|from "\.\./debugLogger"|from "../debug/logger"|g' \
            -e 's|from "\./debugLogger"|from "./debug/logger"|g' \
            -e 's|from "\./utils/container-helpers"|from "../utils/debug"|g' \
            "$file" > "$temp_file"
        
        # Move temp file back
        mv "$temp_file" "$file"
        echo "  Fixed: $file"
    done
}

# Fix imports in all subdirectories
cd /home/mizchi/mizchi/lsmcp/packages/lsp-client/src

for dir in */; do
    fix_imports_in_dir "$dir"
done

echo "Import fixes complete!"