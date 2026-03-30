# Selix Mobile App

Expo app for Selix with 4 mobile spaces:
- Client
- Commercial CRM
- Promoter
- Admin

## Run mobile

```bash
npm install
npm run start
```

Then scan with Expo Go.

## Environment

Create `selix-expo-app/.env` from `.env.example`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.100:3000
```

Use your machine LAN IP when testing on a physical phone.

## Backend

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` from `.env.example` and set your MySQL credentials plus strong JWT secrets.

## Checks

```bash
cd selix-expo-app
npx tsc --noEmit

cd ../backend
node --check server.js
```

## Delivery

- Expo build config is in `selix-expo-app/app.json`.
- EAS profiles are in `selix-expo-app/eas.json`.
- QA steps are in `QA_CHECKLIST.md`.
