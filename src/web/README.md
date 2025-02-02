# Smart Home Dashboard Frontend

[![Build Status](https://github.com/yourusername/smart-home-dashboard/workflows/CI/badge.svg)](https://github.com/yourusername/smart-home-dashboard/actions)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A modern, responsive web frontend for managing smart home devices through an intuitive floor plan-based interface. Built with Vite, React, and TypeScript, integrating seamlessly with Home Assistant.

## Features

- 🏠 Interactive floor plan management with SVG visualization
- 🎯 Drag-and-drop entity placement with real-time updates
- 🔄 WebSocket-based device control and state synchronization
- 📱 Responsive design with mobile-first approach
- 🎨 Light/Dark theme support using CSS variables
- 🔌 Dynamic plugin system for extensibility
- 💾 Local storage for configuration persistence
- 🔒 Secure token-based authentication

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0 or yarn
- Modern web browser with WebSocket support
- Home Assistant instance (for development)

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/smart-home-dashboard.git
cd smart-home-dashboard/src/web
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your Home Assistant details
```

4. Start development server:
```bash
npm run dev
# or
yarn dev
```

## Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build production-ready bundle
- `npm run preview` - Preview production build locally
- `npm run test` - Run test suite with coverage
- `npm run lint` - Lint and auto-fix TypeScript/TSX files
- `npm run format` - Format source files using Prettier
- `npm run typecheck` - Run TypeScript type checking
- `npm run docker:build` - Build Docker container
- `npm run docker:up` - Start Docker container

## Architecture

The Smart Home Dashboard follows a component-based architecture using React and TypeScript:

```
src/
├── components/     # Reusable UI components
├── contexts/      # React contexts for state management
├── hooks/         # Custom React hooks
├── plugins/       # Plugin system implementation
├── services/      # API and WebSocket services
├── styles/        # Global styles and themes
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Development

### Code Style

- TypeScript strict mode enabled
- ESLint with recommended React rules
- Prettier for consistent formatting
- Component-first architecture
- Functional components with hooks

### Plugin Development

Plugins extend dashboard functionality through a standardized API:

```typescript
interface DashboardPlugin {
  id: string;
  version: string;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
}
```

See [Plugin Development Guide](docs/plugins.md) for detailed instructions.

## Production Deployment

### Docker Deployment

1. Build the container:
```bash
npm run docker:build
```

2. Start the container:
```bash
npm run docker:up
```

The dashboard will be available at `http://localhost:80`.

### Manual Deployment

1. Build the production bundle:
```bash
npm run build
```

2. Serve the `dist` directory using your preferred web server.

## Performance Optimization

- Code splitting with dynamic imports
- Asset optimization with Vite
- Aggressive caching strategy
- WebSocket connection pooling
- SVG optimization for floor plans

## Security Considerations

- Token-based authentication with Home Assistant
- Secure WebSocket (WSS) communication
- Content Security Policy implementation
- Local storage encryption for sensitive data
- Regular security dependency updates

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Guidelines

- Follow conventional commits specification
- Include relevant issue numbers
- Keep commits focused and atomic

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Home Assistant team for the WebSocket API
- React team for the amazing framework
- All contributors and plugin developers

---

Built with ❤️ by the Smart Home Dashboard team