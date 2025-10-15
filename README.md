# GatorGather

A full-stack mobile application built with FastAPI, MongoDB, and React Native.

## Overview

This project consists of a RESTful API backend powered by FastAPI and MongoDB, with a React Native mobile frontend for cross-platform iOS and Android support.

## Tech Stack

### Backend
- **FastAPI** - Modern, fast Python web framework
- **MongoDB** - NoSQL database
- **Motor** - Async MongoDB driver for Python
- **Pydantic** - Data validation using Python type annotations

### Frontend
- **React Native** - Cross-platform mobile framework
- **Expo**  Development toolchain
- **Axios** - HTTP client for API requests

## Project Structure

```
project-root/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routes/
│   │   ├── database.py
│   │   └── config.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── services/
│   │   └── App.js
│   ├── package.json
│   └── .env
└── README.md
```

## Prerequisites

- Python 3.8+
- Node.js 16+ and npm/yarn
- MongoDB (local or Atlas)
- React Native development environment setup

## Backend Setup

### 1. Navigate to backend directory
```bash
cd backend
```

### 2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
Create a `.env` file in the backend directory:
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=your_database_name
SECRET_KEY=your_secret_key_here
```

### 5. Run the server
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## Frontend Setup

### 1. Navigate to frontend directory
```bash
cd mobile
```

### 2. Install dependencies
```bash
npm install
```
### 3. Run the app
```bash
# For Expo
npm start
# or
expo start

# For bare React Native
npm run android  # For Android
npm run ios      # For iOS
```


## Key Features

- RESTful API endpoints
- MongoDB database integration
- User authentication (if implemented)
- Cross-platform mobile support
- Real-time data synchronization

## Development

### Backend Development
```bash
# Run with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

### Frontend Development
```bash
# Clear cache
npm start -- --clear

# Run on specific device
npm run android -- --device "device-name"
```

## Environment Variables

### Backend
- `MONGODB_URL` - MongoDB connection string
- `DATABASE_NAME` - Database name
- `SECRET_KEY` - Secret key for JWT tokens

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
