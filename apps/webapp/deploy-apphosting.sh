#!/bin/bash

# Firebase App Hosting Deployment Script for Next.js WebApp
# This script deploys the webapp to Firebase App Hosting with full SSR support

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="homegeekdemo"
WEBAPP_DIR="/Users/prakashbaskaran/projects/HomeApp/apps/webapp"
BACKEND_ID="staging"  # This matches your existing staging backend
REGION="us-central1"

echo -e "${GREEN}Starting Firebase App Hosting deployment...${NC}"

# Change to webapp directory
cd "$WEBAPP_DIR"

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Error: Firebase CLI is not installed${NC}"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check Firebase CLI version (App Hosting requires recent version)
echo -e "${YELLOW}Checking Firebase CLI version...${NC}"
FIREBASE_VERSION=$(firebase --version | cut -d. -f1)
if [ "$FIREBASE_VERSION" -lt 13 ]; then
    echo -e "${YELLOW}Warning: Firebase CLI version might be outdated. Consider updating with: npm install -g firebase-tools@latest${NC}"
fi

# Check if user is logged in to Firebase
echo -e "${YELLOW}Checking Firebase authentication...${NC}"
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Firebase${NC}"
    echo "Run: firebase login"
    exit 1
fi

# Set the Firebase project
echo -e "${YELLOW}Setting Firebase project to ${PROJECT_ID}...${NC}"
firebase use "$PROJECT_ID"

# Install dependencies at root if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Optional: Run type check (uncomment if you want to enforce)
# echo -e "${YELLOW}Running type check...${NC}"
# npm run typecheck

# Deploy to Firebase App Hosting
echo -e "${YELLOW}Deploying to Firebase App Hosting...${NC}"
echo -e "${BLUE}Backend ID: ${BACKEND_ID}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"

# Using apphosting:backends:create for initial setup or rollout for updates
# First, try to rollout (update existing backend)
if firebase apphosting:backends:list --project "$PROJECT_ID" 2>&1 | grep -q "$BACKEND_ID"; then
    echo -e "${BLUE}Updating existing App Hosting backend: ${BACKEND_ID}${NC}"
    firebase apphosting:rollouts:create "$BACKEND_ID" --project "$PROJECT_ID"
else
    echo -e "${RED}Backend '${BACKEND_ID}' not found.${NC}"
    echo -e "${YELLOW}You need to create the App Hosting backend first.${NC}"
    echo -e "${YELLOW}Please run the following command to create it:${NC}"
    echo -e "${BLUE}firebase apphosting:backends:create \\ ${NC}"
    echo -e "${BLUE}  --project ${PROJECT_ID} \\ ${NC}"
    echo -e "${BLUE}  --location ${REGION} \\ ${NC}"
    echo -e "${BLUE}  --service-account=githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com${NC}"
    echo -e ""
    echo -e "${YELLOW}Or, if you want to link to your existing GitHub repo:${NC}"
    echo -e "${BLUE}firebase apphosting:backends:create ${BACKEND_ID} \\ ${NC}"
    echo -e "${BLUE}  --project ${PROJECT_ID} \\ ${NC}"
    echo -e "${BLUE}  --location ${REGION}${NC}"
    exit 1
fi

# Check deployment status
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment initiated successfully!${NC}"
    echo -e "${GREEN}Your webapp will be available at: https://${BACKEND_ID}--${PROJECT_ID}.${REGION}.hosted.app${NC}"
    echo -e "${BLUE}Monitor the deployment status with:${NC}"
    echo -e "${BLUE}firebase apphosting:rollouts:list ${BACKEND_ID} --project ${PROJECT_ID}${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi
