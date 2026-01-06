# Repository Migration Guide

This guide will help you reorganize the project into a monorepo structure with submodules.

## New Repository Structure

### Individual Repositories (to be created on GitHub):
1. **Mbor_Mrg_directus** - Directus backend and database setup
2. **Mbor_Mrg_n8n** - n8n workflow automation
3. **Mbor_Mrg_Frontend** - Frontend Vue.js application

### Main Repository:
- **Mbor_Mrg_TravelAdvisor** - Main monorepo that contains all 3 as submodules

## Step-by-Step Migration

### Step 1: Create New GitHub Repositories

Create these 3 empty repositories on GitHub:
- `Mbor_Mrg_directus`
- `Mbor_Mrg_n8n`
- `Mbor_Mrg_Frontend`

### Step 2: Migrate Directus Repository

```powershell
cd directus
git remote rename origin old-origin
git remote add origin https://github.com/MateuszBorsuk2001/Mbor_Mrg_directus.git
git push -u origin master
```

### Step 3: Migrate n8n Repository

```powershell
cd n8n
git add .
git commit -m "Initial commit: n8n workflow automation"
git remote add origin https://github.com/MateuszBorsuk2001/Mbor_Mrg_n8n.git
git push -u origin master
```

### Step 4: Migrate Frontend Repository

```powershell
cd travel-search-frontend
git remote rename origin old-origin
git remote add origin https://github.com/MateuszBorsuk2001/Mbor_Mrg_Frontend.git
git push -u origin master
```

### Step 5: Set Up Main Repository

```powershell
cd .. (back to root)
git init
git remote add origin https://github.com/MateuszBorsuk2001/Mbor_Mrg_TravelAdvisor.git
git submodule add https://github.com/MateuszBorsuk2001/Mbor_Mrg_directus.git directus
git submodule add https://github.com/MateuszBorsuk2001/Mbor_Mrg_n8n.git n8n
git submodule add https://github.com/MateuszBorsuk2001/Mbor_Mrg_Frontend.git travel-search-frontend
git add .gitmodules
git commit -m "Initial commit: TravelAdvisor monorepo with submodules"
git push -u origin master
```

## After Migration

To clone the entire project:
```bash
git clone --recurse-submodules https://github.com/MateuszBorsuk2001/Mbor_Mrg_TravelAdvisor.git
```

To update submodules:
```bash
git submodule update --remote
```

