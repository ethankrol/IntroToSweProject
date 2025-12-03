# GatorGather 📱

A full-stack mobile application built with **FastAPI**, **MongoDB**, and **React Native**.

## Overview

This project consists of a **RESTful API backend** powered by FastAPI and MongoDB, with a **React Native mobile frontend** for cross-platform iOS and Android support.

---

## Tech Stack 🛠️

### Backend
* **FastAPI** - Modern, fast Python web framework for the API.
* **MongoDB** - NoSQL database for flexible data storage.
* **Pydantic** - Data validation using Python type annotations.

### Frontend
* **React Native** - Cross-platform mobile framework for building native apps using JavaScript.
* **Expo** - Development toolchain for building and deploying React Native apps quickly.
* **Axios** - Promise-based HTTP client for making API requests.

---

## Project Structure 📂

```text
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
├── mobile/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── services/
│   │   └── App.tsx
│   ├── package.json
└── README.md
```

---

## Prerequisites ⚙️

Before starting, ensure you have the following installed:
* **Python 3.8+**
* **Node.js 16+** and **npm** (or yarn)
* **MongoDB** (local server or MongoDB Atlas access)
* **React Native** / **Expo** development environment setup.

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone [https://github.com/ethankrol/IntroToSweProject.git](https://github.com/ethankrol/IntroToSweProject.git)
```
Open the project root folder (`/IntroToSweProject`) in your IDE.

---

### 2. Backend Server Setup 🐍

The root directory for the backend is `backend/`.

#### a. Navigate and Create Virtual Environment
```bash
cd backend
python -m venv venv
```
Activate the environment:
* **On Linux/Mac:** `source venv/bin/activate`
* **On Windows (Command Prompt):** `venv\Scripts\activate`
* **On Windows (PowerShell):** `venv\Scripts\Activate.ps1`

#### b. Install Dependencies
```bash
pip install -r requirements.txt
```
> **Note:** You may need to restart your IDE or select the correct Python interpreter after installation.

#### c. Configure Environment Variables
Create a file named **`.env`** in the **`backend`** directory and populate it with your configuration details.

```env
# Essential configuration variables
SECRET_KEY=your_secret_key_here
ACCESS_TOKEN_EXPIRE_MINUTES=30
MONGO_URL=mongodb_connection_string_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Email settings
EMAIL_FROM=GatorGather <noreply.gatorgather@gmail.com>
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_smtp_user_here
SMTP_PASS=your_smtp_password_here
SMTP_TLS=true
DEBUG_EMAIL_FALLBACK=true
FRONTEND_URL=gatorgather://
```

#### d. Run the Backend Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
The API will be available at `http://0.0.0.0:8000`.

---

### 3. Frontend Setup (Mobile) ⚛️

The root directory for the frontend is `mobile/`. Use a **new terminal window** for the frontend.

#### a. Navigate and Install Dependencies
```bash
cd mobile
npm install
```

#### b. Configure API Base URL
In the file **`mobile/src/config.ts`**, you must set the `API_BASE_URL` variable to point to your running backend server.

```typescript
// Central place to configure your backend base URL.
// NOTE: 127.0.0.1 points to the device/emulator itself in React Native.
// - iOS simulator can often reach your Mac at [http://127.0.0.1:8000](http://127.0.0.1:8000)
// - Android emulator often needs [http://10.0.2.2:8000](http://10.0.2.2:8000)
// - Physical devices need your machine's LAN IP, e.g. [http://192.168.1.10:8000](http://192.168.1.10:8000)
export const API_BASE_URL = "[http://00](http://00).00.00.00:8000"; // Update with your actual IP address
```

#### c. Run the Frontend App
```bash
npm start
```
This will open the Expo CLI interface. Follow the steps in the interface to connect to the frontend (e.g., press `i` to open the XCode iOS simulator on Mac).

---

## Key Features ✨

* **RESTful API** endpoints for resource management.
* **MongoDB** database integration via an asynchronous driver.
* User **authentication** and authorization.
* **Cross-platform mobile support** (iOS and Android) via React Native/Expo.

---

## Development

### Backend Development
```bash
# Run with auto-reload for development
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
# Start the Expo development server
npm start

# Clear cache if experiencing issues
npm start -- --clear
```

---

## Contributing 🤝

1.  Fork the repository
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a **Pull Request**

---

## License

This project is licensed under the **MIT License** - see the LICENSE file for details.
