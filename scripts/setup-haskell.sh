#!/bin/bash

# Setup script for Haskell development environment using ghcup

set -e

echo "Setting up Haskell development environment..."

# Check if ghcup is installed
if ! command -v ghcup &> /dev/null; then
    echo "Installing ghcup..."
    curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
    
    # Source ghcup environment
    [ -f "$HOME/.ghcup/env" ] && source "$HOME/.ghcup/env"
else
    echo "ghcup is already installed"
fi

# Install GHC and HLS
echo "Installing GHC and HLS..."
ghcup install ghc recommended --set
ghcup install hls latest --set
ghcup install cabal latest --set
ghcup install stack latest --set

# Verify installations
echo "Verifying installations..."
echo "GHC version: $(ghc --version)"
echo "HLS version: $(haskell-language-server-wrapper --version || echo 'HLS not found')"
echo "Cabal version: $(cabal --version | head -n1)"
echo "Stack version: $(stack --version)"

echo "Haskell environment setup complete!"
echo ""
echo "To use this environment, make sure to add the following to your shell profile:"
echo '  [ -f "$HOME/.ghcup/env" ] && source "$HOME/.ghcup/env"'