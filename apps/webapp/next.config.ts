import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@homeapp/common'],
  webpack: (config, { isServer }) => {
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    // Resolve @homeapp/common to the common src directory
    const commonSrcPath = path.resolve(__dirname, '../common/src');
    config.resolve.alias['@homeapp/common'] = commonSrcPath;
    
    // Also add to modules for better resolution
    if (!config.resolve.modules) {
      config.resolve.modules = ['node_modules'];
    }
    if (Array.isArray(config.resolve.modules)) {
      config.resolve.modules.push(commonSrcPath);
    }
    
    // Ensure extensions are resolved
    if (!config.resolve.extensions) {
      config.resolve.extensions = ['.js', '.jsx', '.ts', '.tsx'];
    }
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.gstatic.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
