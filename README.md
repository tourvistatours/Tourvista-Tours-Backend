# 🚀 Tourvista Backend API

A scalable backend built with **NestJS**, **Prisma**, and **PostgreSQL** for a travel booking platform.

---

## 📌 Overview

This backend handles core features of the Tourvista platform:

- Contact management
- User sync via **Clerk webhooks**
- Tour bookings
- Payment integration
- User–booking relationships

Designed with a **modular and clean architecture** for easy scaling.

---

## ⚙️ Tech Stack

- **NestJS** – Backend framework
- **PostgreSQL** – Database
- **Prisma ORM** – Database access
- **Clerk** – Authentication (via webhook)
- **Webxpay** – Payment integration

---

## 📦 Features

### Contact

- Create message
- Get all (pagination + search)
- Delete message

### Users

- Synced from Clerk via webhook

### Bookings

- Create booking
- Link bookings to users

### Payments

- Linked to bookings
- Track payment status

---

## 🔗 API Endpoints

### Contact

```http
POST   /contact
GET    /contact?page=1&limit=10&search=
DELETE /contact/:id
```

### Webhook

```http
POST /webhook/clerk
```

### Bookings

```http
POST /bookings
GET  /bookings
GET  /bookings/:id
```

### Payments

```http
POST /payments/initiate
POST /payments/confirm
GET  /payments/:bookingId
```

---

## 🌍 Environment Variables

```env
PORT=5000
DATABASE_URL=postgresql://user:password@host/dbname

CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

PAYMENT_PROVIDER_KEY=
```

---

## ⚙️ Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

---

## 🧱 Structure

```text
src/
├── contact/
├── bookings/
├── payments/
├── webhook/
├── prisma/
└── utils/
```

---

## 👨‍💻 Author

Softro Engineering Team

---

## 📄 License

This project is proprietary software developed by **Softro**.

Usage rights are granted only to the client (Pushpakumara) for internal business operations.

- Source code ownership remains with Softro
- Redistribution or resale is not permitted
- Modification requires prior approval

A limited **1-year warranty and support period** is provided from the date of delivery.

For full terms, refer to the LICENSE file.

---
