# Procure-to-Pay System

A full-stack **Procure-to-Pay** system built with Django REST Framework (backend) and React (frontend), featuring multi-level approval workflows, AI-powered document processing, and role-based access control.

## 🚀 Features

- **Purchase Request Management**: Staff can create, view, and manage purchase requests
- **Multi-Level Approval Workflow**: Configurable approval levels with parallel approval support
- **AI-Powered Document Processing**: Automatic extraction of data from proforma invoices using Google Gemini API
- **Purchase Order Generation**: Automatic PO generation upon final approval
- **Receipt Validation**: Compare receipts against purchase orders to flag discrepancies
- **Role-Based Access Control**: Staff, Approvers (Level 1/2), Finance, and Admin roles
- **JWT Authentication**: Secure token-based authentication
- **RESTful API**: Well-documented API with Swagger/OpenAPI
- **Real-time Updates**: Background task processing with Celery
- **Responsive UI**: Modern React frontend with Tailwind CSS

## 🛠 Tech Stack

### Backend
- **Framework**: Django 4.2 + Django REST Framework
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + Celery
- **Authentication**: JWT (djangorestframework-simplejwt)
- **Document Processing**: Google Gemini API (free alternative to OpenAI)
- **Testing**: pytest
- **API Documentation**: drf-yasg (Swagger/OpenAPI)

### Frontend
- **Framework**: React 18 (Create React App)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Yup validation
- **Routing**: React Router
- **HTTP Client**: Axios
- **Tables**: TanStack Table

### Deployment
- **Containerization**: Docker + Docker Compose
- **Cloud Platform**: Fly.io
- **Web Server**: Gunicorn (backend) + Nginx (frontend)

## 📁 Project Structure

```
Procure-to-Pay/
├── backend/                    # Django backend
│   ├── procure_to_pay/        # Django project settings
│   ├── procurement/           # Main app
│   │   ├── models.py         # Data models
│   │   ├── views.py          # API views
│   │   ├── serializers.py    # DRF serializers
│   │   ├── tasks.py          # Celery tasks
│   │   └── document_processing.py  # AI document processing
│   ├── tests/                # Test suite
│   ├── Dockerfile.prod       # Production Dockerfile
│   ├── fly.toml             # Fly.io configuration
│   ├── supervisord.conf     # Process manager config
│   ├── requirements.txt     # Python dependencies
│   └── env.example          # Environment variables template
│
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── context/        # React contexts
│   ├── public/
│   ├── Dockerfile          # Frontend Dockerfile
│   ├── nginx.conf          # Nginx configuration
│   ├── package.json        # Node dependencies
│   └── .env.example        # Frontend env template (if needed)
│
├── docker-compose.yml        # Full stack Docker setup
├── .gitignore               # Git ignore rules
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 15+**
- **Redis** (or use Docker)
- **Docker & Docker Compose** (optional, for containerized setup)

### Option 1: Local Development

#### Backend Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Procure-to-Pay
   ```

2. **Set up Python virtual environment**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your settings (database, API keys, etc.)
   ```

5. **Set up database**:
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Start Redis** (if not using Docker):
   ```bash
   # macOS (Homebrew)
   brew install redis
   brew services start redis
   
   # Or use Docker
   docker run -d -p 6379:6379 redis:7-alpine
   ```

7. **Start Celery worker** (in a separate terminal):
   ```bash
   celery -A procure_to_pay worker -l info
   ```

8. **Run the server**:
   ```bash
   python manage.py runserver
   ```

Backend will be available at: `http://localhost:8000`

#### Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server**:
   ```bash
   npm start
   ```

Frontend will be available at: `http://localhost:3000`

### Option 2: Docker (Recommended)

1. **Copy environment file**:
   ```bash
   cp env.example .env
   # Edit .env with your settings
   ```

2. **Build and start all services**:
   ```bash
   docker-compose up --build
   ```

This will start:
- PostgreSQL database (port 5432)
- Redis (port 6379)
- Django backend (http://localhost:8000)
- React frontend (http://localhost:3000)
- Celery worker
- Celery beat

3. **Run migrations**:
   ```bash
   docker-compose exec backend python manage.py migrate
   docker-compose exec backend python manage.py createsuperuser
   ```

## 🔧 Configuration

### Environment Variables

#### Backend (`backend/env.example`)

Key variables:
- `SECRET_KEY` - Django secret key (generate a new one for production!)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `GOOGLE_GEMINI_API_KEY` - Google Gemini API key (free alternative to OpenAI)
- `EMAIL_BACKEND` - Email backend (console for dev, smtp for production)
- `CORS_ALLOWED_ORIGINS` - Frontend URLs

See `backend/env.example` for all available options.

#### Frontend

The frontend automatically detects localhost and uses the local backend. For production, configure via `frontend/public/config.js` or environment variables.

### API Documentation

Once the backend is running, access:
- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/
- **OpenAPI Schema**: http://localhost:8000/swagger/?format=openapi

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest
```

Run with coverage:
```bash
pytest --cov=procurement --cov-report=html
```

## 📦 Deployment

### Fly.io Deployment

The project is configured for deployment on Fly.io. See deployment guides in the repository for detailed instructions.

**Quick deploy commands**:

```bash
# Backend
cd backend
flyctl deploy --app your-backend-app

# Frontend
cd frontend
flyctl deploy --app your-frontend-app
```

## 🔐 Authentication

The API uses JWT (JSON Web Token) authentication:

1. **Register**: `POST /api/auth/register/`
2. **Login**: `POST /api/token/` (returns access and refresh tokens)
3. **Use token**: Include `Authorization: Bearer <access_token>` header in requests
4. **Refresh token**: `POST /api/token/refresh/` when access token expires

## 👥 User Roles

- **Staff**: Create and manage their own purchase requests
- **Approver Level 1**: Approve/reject requests at level 1
- **Approver Level 2**: Approve/reject requests at level 2
- **Finance**: View and interact with all approved requests
- **Admin**: Full system access, manage users, request types, and approval levels

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register/` - Register new user
- `POST /api/token/` - Get JWT tokens
- `POST /api/token/refresh/` - Refresh access token
- `GET /api/auth/me/` - Get current user info

### Purchase Requests
- `GET /api/requests/` - List requests (filtered by role)
- `POST /api/requests/` - Create request (Staff only)
- `GET /api/requests/{id}/` - Get request details
- `PUT /api/requests/{id}/` - Update request (Staff, if pending)
- `PATCH /api/requests/{id}/approve/` - Approve request (Approver)
- `PATCH /api/requests/{id}/reject/` - Reject request (Approver)
- `POST /api/requests/{id}/submit-receipt/` - Submit receipt (Staff)

### Admin
- `GET /api/users/` - List users (Admin only)
- `POST /api/users/` - Create user (Admin only)
- `GET /api/request-types/` - List request types
- `GET /api/approval-levels/` - List approval levels

See Swagger UI for complete API documentation.

## 🤖 AI Document Processing

The system uses Google Gemini API (free) to extract data from proforma invoices:

- **Automatic extraction**: Vendor name, items, prices, terms
- **Fallback to OCR**: If AI fails, uses OCR (pytesseract)
- **Background processing**: Handled by Celery for better performance

## 📄 License

This project is part of a technical assessment.

## 👨‍💻 Author

Built as part of the IST Africa Full Stack Python/Django Developer assessment.

## 🙏 Acknowledgments

- Django REST Framework
- React
- Google Gemini API (free AI alternative)
- Fly.io for hosting

