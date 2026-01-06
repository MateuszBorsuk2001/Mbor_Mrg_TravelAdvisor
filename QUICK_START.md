# Quick Start - Repository Migration

## Prerequisites

1. Create 4 empty repositories on GitHub:
   - `Mbor_Mrg_directus`
   - `Mbor_Mrg_n8n`
   - `Mbor_Mrg_Frontend`
   - `Mbor_Mrg_TravelAdvisor`

## Migration Steps

### 1. Migrate Individual Repositories

Run the migration script:
```powershell
.\migrate-repos.ps1
```

Then push each repository:
```powershell
cd directus
git push -u origin master
cd ..

cd n8n
git push -u origin master
cd ..

cd travel-search-frontend
git push -u origin master
cd ..
```

### 2. Set Up Main Repository

Run the setup script:
```powershell
.\setup-main-repo.ps1
```

Then commit and push:
```powershell
git add .
git commit -m "Initial commit: TravelAdvisor monorepo with submodules"
git push -u origin master
```

## Verification

After migration, verify the structure:
```powershell
git submodule status
```

You should see all three submodules listed.

## Cloning After Migration

Others can clone the entire project with:
```bash
git clone --recurse-submodules https://github.com/MateuszBorsuk2001/Mbor_Mrg_TravelAdvisor.git
```

