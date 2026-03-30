# Selix Run And Build

## Local run

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Check before run:
- `backend/.env` points to the right MySQL instance.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` stay private.

### 2. Mobile app

```bash
cd selix-expo-app
npm install
npm run start
```

Check before run:
- `selix-expo-app/.env` uses your machine LAN IP, not `localhost`, when testing on a phone.
- Expo Go and backend must be on the same network.

## Validation

```bash
cd selix-expo-app
npx tsc --noEmit

cd ../backend
node --check server.js
```

## EAS build

```bash
cd selix-expo-app
npx eas login
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview
```

## Before store submission

- Replace the local database password with production credentials outside the repo.
- Keep `.env` files private and commit only `.env.example`.
- Test the app on a real Android device.
- Test the app on a real iPhone or a macOS simulator.
- Verify auth, questionnaire, favorites, messages, visits, projects, and admin actions.
