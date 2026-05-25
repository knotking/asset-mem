#!/bin/bash

# AssetMem AI (mapp) Deployment Script
# This script helps deploy the React Native/Expo app locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy AssetMem AI mapp (React Native/Expo App)

OPTIONS:
    build           Build the app using EAS Build
    update          Publish an OTA update using EAS Update
    submit          Submit the app to app stores
    help            Show this help message

BUILD OPTIONS:
    --platform      Platform to build (ios|android|all) [default: all]
    --profile       Build profile (development|preview|staging|prod) [default: staging]

UPDATE OPTIONS:
    --channel       Update channel (staging|prod) [default: staging]
    --message       Update message/description

SUBMIT OPTIONS:
    --platform      Platform to submit (ios|android|all) [default: all]

EXAMPLES:
    $0 build --platform ios --profile prod
    $0 update --channel staging --message "Bug fixes and improvements"
    $0 submit --platform android

EOF
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi

    if ! command_exists eas; then
        print_error "EAS CLI is not installed. Installing now..."
        npm install -g eas-cli
    fi

    print_success "All prerequisites are met"
}

# Check if user is logged in to Expo
check_expo_auth() {
    print_info "Checking Expo authentication..."

    if ! eas whoami >/dev/null 2>&1; then
        print_warning "Not logged in to Expo. Please log in..."
        eas login
    else
        EXPO_USER=$(eas whoami)
        print_success "Logged in as: $EXPO_USER"
    fi
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."

    # Install root dependencies
    cd "$SCRIPT_DIR/../.."
    npm ci

    # Install mapp dependencies
    cd "$SCRIPT_DIR"
    npm ci

    print_success "Dependencies installed"
}

# Build function
build_app() {
    local platform="${1:-all}"
    local profile="${2:-staging}"

    print_info "Building app for platform: $platform, profile: $profile"

    check_prerequisites
    check_expo_auth
    install_dependencies

    if [ "$platform" = "all" ]; then
        print_info "Building for iOS..."
        eas build --platform ios --profile "$profile"

        print_info "Building for Android..."
        eas build --platform android --profile "$profile"
    else
        eas build --platform "$platform" --profile "$profile"
    fi

    print_success "Build completed!"
    print_info "Check build status on expo.dev (project slug from APP_SLUG in eas.json, e.g. assetmem-staging)"
}

# Update function (OTA)
publish_update() {
    local channel="${1:-staging}"
    local message="${2:-Update from deploy script}"

    print_info "Publishing OTA update to channel: $channel"
    print_info "Message: $message"

    check_prerequisites
    check_expo_auth
    install_dependencies

    eas update --channel "$channel" --message "$message"

    print_success "Update published!"
    print_info "Check update status on expo.dev (project slug from eas.json channel)"
}

# Submit function
submit_app() {
    local platform="${1:-all}"

    print_info "Submitting app to stores for platform: $platform"

    check_prerequisites
    check_expo_auth

    if [ "$platform" = "all" ]; then
        print_info "Submitting to App Store..."
        eas submit --platform ios --profile prod --latest

        print_info "Submitting to Google Play..."
        eas submit --platform android --profile prod --latest
    else
        eas submit --platform "$platform" --profile prod --latest
    fi

    print_success "Submission completed!"
}

# Parse arguments
ACTION="${1:-help}"
shift || true

case "$ACTION" in
    build)
        PLATFORM="all"
        PROFILE="staging"

        while [[ $# -gt 0 ]]; do
            case $1 in
                --platform)
                    PLATFORM="$2"
                    shift 2
                    ;;
                --profile)
                    PROFILE="$2"
                    shift 2
                    ;;
                *)
                    print_error "Unknown option: $1"
                    show_usage
                    exit 1
                    ;;
            esac
        done

        build_app "$PLATFORM" "$PROFILE"
        ;;

    update)
        CHANNEL="staging"
        MESSAGE="Update from deploy script"

        while [[ $# -gt 0 ]]; do
            case $1 in
                --channel)
                    CHANNEL="$2"
                    shift 2
                    ;;
                --message)
                    MESSAGE="$2"
                    shift 2
                    ;;
                *)
                    print_error "Unknown option: $1"
                    show_usage
                    exit 1
                    ;;
            esac
        done

        publish_update "$CHANNEL" "$MESSAGE"
        ;;

    submit)
        PLATFORM="all"

        while [[ $# -gt 0 ]]; do
            case $1 in
                --platform)
                    PLATFORM="$2"
                    shift 2
                    ;;
                *)
                    print_error "Unknown option: $1"
                    show_usage
                    exit 1
                    ;;
            esac
        done

        submit_app "$PLATFORM"
        ;;

    help|--help|-h)
        show_usage
        exit 0
        ;;

    *)
        print_error "Unknown action: $ACTION"
        show_usage
        exit 1
        ;;
esac
