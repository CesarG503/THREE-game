import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { prisma } from "../db/prisma.js"

const PASSWORD_KEY_LENGTH = 64
const SESSION_TOKEN_BYTES = 32

export interface AuthInput {
  email?: unknown
  username?: unknown
  password?: unknown
}

export class AuthError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function registerUser(input: AuthInput) {
  const email = normalizeEmail(input.email)
  const username = normalizeUsername(input.username)
  const password = normalizePassword(input.password)

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username },
      ],
    },
    select: { id: true },
  })

  if (existing) {
    throw new AuthError(409, "El email o usuario ya esta registrado")
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName: username,
      passwordHash: hashPassword(password),
    },
    select: publicUserSelect,
  })

  const session = await createSession(user.id)
  return { user, session }
}

export async function loginUser(input: AuthInput) {
  const identifier = normalizeLoginIdentifier(input.email ?? input.username)
  const password = normalizePassword(input.password)

  const userWithPassword = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      createdAt: true,
      passwordHash: true,
    },
  })

  if (!userWithPassword || !verifyPassword(password, userWithPassword.passwordHash)) {
    throw new AuthError(401, "Credenciales invalidas")
  }

  const session = await createSession(userWithPassword.id)
  const { passwordHash, ...user } = userWithPassword
  void passwordHash
  return { user, session }
}

async function createSession(userId: string) {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex")
  const days = Number(process.env.AUTH_SESSION_DAYS || 7)
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const session = await prisma.userSession.create({
    data: {
      token,
      userId,
      expiresAt,
    },
    select: {
      token: true,
      expiresAt: true,
    },
  })

  return session
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex")
  return `scrypt:${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, hash] = storedHash.split(":")
  if (algorithm !== "scrypt" || !salt || !hash) return false

  const hashedInput = scryptSync(password, salt, PASSWORD_KEY_LENGTH)
  const storedBuffer = Buffer.from(hash, "hex")
  if (storedBuffer.length !== hashedInput.length) return false

  return timingSafeEqual(storedBuffer, hashedInput)
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError(400, "Email requerido")
  }
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError(400, "Email invalido")
  }
  return email
}

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError(400, "Usuario requerido")
  }
  const username = value.trim()
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    throw new AuthError(400, "El usuario debe tener 3-24 caracteres: letras, numeros o _")
  }
  return username
}

function normalizePassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError(400, "Contrasena requerida")
  }
  if (value.length < 6 || value.length > 128) {
    throw new AuthError(400, "La contrasena debe tener entre 6 y 128 caracteres")
  }
  return value
}

function normalizeLoginIdentifier(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthError(400, "Email o usuario requerido")
  }
  return value.trim()
}

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  createdAt: true,
} as const

