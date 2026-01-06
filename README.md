# TravelAdvisor - Monorepo

This is the main repository for the TravelAdvisor project, which uses Git submodules to manage multiple components.

## Repository Structure

This monorepo contains the following submodules:

- **directus/** - Directus CMS backend and database setup
- **n8n/** - n8n workflow automation
- **travel-search-frontend/** - Vue.js frontend application

## Getting Started

### Prerequisites

- Git (with submodule support)
- Node.js and npm
- Docker (for Directus and n8n)

### Cloning the Repository

To clone this repository with all submodules:

```bash
git clone --recurse-submodules https://github.com/MateuszBorsuk2001/Mbor_Mrg_TravelAdvisor.git
```

If you've already cloned the repository without submodules:

```bash
git submodule update --init --recursive
```

### Updating Submodules

To update all submodules to their latest commits:

```bash
git submodule update --remote
```

To update a specific submodule:

```bash
cd directus
git pull origin master
cd ..
```

## Project Components

### Directus (`directus/`)

Directus CMS backend with database setup and Docker configuration.

**Repository:** [Mbor_Mrg_directus](https://github.com/MateuszBorsuk2001/Mbor_Mrg_directus)

### n8n (`n8n/`)

Workflow automation using n8n.

**Repository:** [Mbor_Mrg_n8n](https://github.com/MateuszBorsuk2001/Mbor_Mrg_n8n)

### Travel Search Frontend (`travel-search-frontend/`)

Vue.js frontend application for travel search functionality.

**Repository:** [Mbor_Mrg_Frontend](https://github.com/MateuszBorsuk2001/Mbor_Mrg_Frontend)

## Development Workflow

### Working with Submodules

1. **Making changes to a submodule:**
   ```bash
   cd directus
   # Make your changes
   git add .
   git commit -m "Your commit message"
   git push origin master
   cd ..
   ```

2. **Updating the main repo to point to new submodule commits:**
   ```bash
   git add directus
   git commit -m "Update directus submodule"
   git push origin master
   ```

3. **Pulling latest changes (including submodule updates):**
   ```bash
   git pull
   git submodule update --init --recursive
   ```

## Migration Guide

If you're migrating from the old repository structure, see [REPO_MIGRATION_GUIDE.md](./REPO_MIGRATION_GUIDE.md) for detailed instructions.

## License

[Add your license information here]

