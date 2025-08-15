# Haskell Language Server Setup

This document describes how to set up Haskell Language Server (HLS) for use with lsmcp.

## Prerequisites

- Linux, macOS, or Windows (WSL)
- Internet connection for downloading tools

## Installation using ghcup (Recommended)

### Automated Setup

Run the provided setup script:

```bash
./scripts/setup-haskell.sh
```

This script will:
1. Install ghcup if not already installed
2. Install the recommended GHC version
3. Install the latest HLS version
4. Install Cabal and Stack

### Manual Setup

If you prefer to install manually:

1. Install ghcup:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
```

2. Install GHC and HLS:
```bash
ghcup install ghc recommended --set
ghcup install hls latest --set
```

3. (Optional) Install build tools:
```bash
ghcup install cabal latest --set
ghcup install stack latest --set
```

## Environment Configuration

Add the following to your shell profile (~/.bashrc, ~/.zshrc, etc.):

```bash
[ -f "$HOME/.ghcup/env" ] && source "$HOME/.ghcup/env"
```

## Project Configuration

For HLS to work properly with your Haskell project, create a `hie.yaml` file in your project root:

```yaml
cradle:
  direct:
    arguments: []
```

For more complex projects, you may need different configurations:

### Stack Projects
```yaml
cradle:
  stack:
```

### Cabal Projects
```yaml
cradle:
  cabal:
```

## Verifying Installation

Check that HLS is properly installed:

```bash
haskell-language-server-wrapper --version
```

## Testing with lsmcp

Run the Haskell tests to verify everything is working:

```bash
pnpm test tests/languages/language-tests/haskell.test.ts
```

## Troubleshooting

### HLS not found
- Ensure ghcup's bin directory is in your PATH
- Run `source "$HOME/.ghcup/env"` in your current shell
- Check `~/.ghcup/bin/` for the HLS executable

### Type errors not detected
- Make sure you have a proper `hie.yaml` file in your project
- HLS may take time to initialize on first run
- Check HLS logs for any configuration issues

### Performance issues
- HLS can be resource-intensive for large projects
- Consider increasing timeout values in the HLS preset configuration
- Use `haskell-language-server-wrapper` instead of `haskell-language-server` for automatic GHC version detection

## CI/CD Setup

For GitHub Actions, use the following workflow snippet:

```yaml
- name: Setup Haskell with ghcup
  run: |
    curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | \
      BOOTSTRAP_HASKELL_NONINTERACTIVE=1 BOOTSTRAP_HASKELL_MINIMAL=1 sh
    echo "$HOME/.ghcup/bin" >> $GITHUB_PATH
    
- name: Install GHC and HLS
  run: |
    source "$HOME/.ghcup/env"
    ghcup install ghc recommended --set
    ghcup install hls latest --set
```

## Additional Resources

- [HLS Documentation](https://haskell-language-server.readthedocs.io/)
- [ghcup Documentation](https://www.haskell.org/ghcup/)
- [hie.yaml Configuration Guide](https://github.com/haskell/hie-bios#configuration)