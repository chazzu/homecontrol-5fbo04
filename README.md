# Smart Home Dashboard

[![CI/CD Status](https://github.com/yourusername/smart-home-dashboard/workflows/CI/CD/badge.svg)](https://github.com/yourusername/smart-home-dashboard/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/yourusername/smart-home-dashboard)](package.json)
[![Dependencies](https://img.shields.io/librariesio/github/yourusername/smart-home-dashboard)](package.json)
[![Code Coverage](https://codecov.io/gh/yourusername/smart-home-dashboard/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/smart-home-dashboard)
[![Security Scan](https://github.com/yourusername/smart-home-dashboard/workflows/security/badge.svg)](https://github.com/yourusername/smart-home-dashboard/security)

An advanced browser-based smart home control interface featuring interactive floor plan visualization and real-time device management capabilities. Built with modern web technologies and seamlessly integrated with Home Assistant.

## Overview

Smart Home Dashboard revolutionizes smart home control by providing an intuitive, visual approach to device management through customizable floor plans.

### Key Features

- 🏠 Interactive floor plan-based device management
- 🎯 Drag-and-drop entity placement interface
- ⚡ Real-time device state monitoring and control
- 🔒 Secure Home Assistant integration via WebSocket
- 🔌 Extensible plugin system with security scanning
- 📱 Responsive design with theme support
- 💾 Offline configuration persistence
- 🏗️ Multi-floor support with zoom capabilities

### System Architecture

The dashboard implements a modern, layered architecture:

- **Frontend Layer**: React-based SPA with TypeScript
- **State Management**: React Context for efficient state handling
- **Communication**: WebSocket for real-time Home Assistant integration
- **Storage**: Browser LocalStorage for configuration persistence
- **Plugin System**: Dynamic loading with security validation

### Technical Stack

- **Build System**: Vite 4.0+
- **UI Framework**: React 18.0+
- **Language**: TypeScript 5.0+
- **Compiler**: SWC 1.3+
- **Styling**: styled-components 6.0+
- **Communication**: home-assistant-js-websocket 8.0+
- **Testing**: Jest 29.0+, React Testing Library 13.0+

## Getting Started

### Prerequisites

- Node.js 16.0+
- npm 8.0+ or yarn 1.22+
- Modern web browser (Chrome 90+, Firefox 90+, Safari 15+)
- Home Assistant instance with WebSocket API enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/smart-home-dashboard.git

# Navigate to project directory
cd smart-home-dashboard

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env

# Start development server
npm run dev
```

### Configuration

1. Copy `.env.example` to `.env`
2. Configure Home Assistant connection:
   ```env
   VITE_HA_URL=http://your-ha-instance:8123
   VITE_HA_TOKEN=your_long_lived_access_token
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run test` - Run test suite
- `npm run lint` - Lint source code
- `npm run format` - Format source code
- `npm run analyze` - Analyze bundle size

### Project Structure

```
smart-home-dashboard/
├── src/
│   ├── components/     # React components
│   ├── hooks/         # Custom React hooks
│   ├── contexts/      # React contexts
│   ├── services/      # API services
│   ├── utils/         # Utility functions
│   ├── types/         # TypeScript definitions
│   └── plugins/       # Plugin system
├── public/            # Static assets
├── tests/            # Test files
└── vite.config.ts    # Vite configuration
```

### Plugin Development

Plugins extend dashboard functionality through a secure API:

```typescript
interface DashboardPlugin {
  id: string;
  version: string;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
}
```

## Usage Guide

### Floor Plan Management

1. Upload floor plan image (SVG format recommended)
2. Configure scale and orientation
3. Add multiple floors if needed
4. Save configuration

### Entity Placement

1. Select entity from sidebar
2. Drag to desired location on floor plan
3. Configure entity properties
4. Save placement

### Device Control

- Single tap: Toggle device state
- Long press: Open detailed control dialog
- Swipe gestures: Adjust values (brightness, temperature)

## Security

### Authentication

- Token-based authentication with Home Assistant
- Secure WebSocket communication (WSS)
- Session management with automatic token refresh

### Data Protection

- Local storage encryption for sensitive data
- Secure plugin validation and sandboxing
- Content Security Policy implementation

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) for details.

### Development Process

1. Fork the repository
2. Create a feature branch
3. Implement changes
4. Add tests
5. Submit pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://github.com/yourusername/smart-home-dashboard/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/smart-home-dashboard/issues)
- 💬 [Discussions](https://github.com/yourusername/smart-home-dashboard/discussions)