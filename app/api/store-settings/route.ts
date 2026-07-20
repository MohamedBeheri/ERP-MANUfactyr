import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getStoreSettings } from '@/lib/store'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const settings = await getStoreSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    await getStoreSettings()
    const b = await req.json()
    const settings = await prisma.storeSettings.update({
      where: { id: 'store' },
      data: {
        storeName: b.storeName?.trim() || undefined,
        tagline: b.tagline ?? undefined,
        heroImage: b.heroImage ?? undefined,
        phone: b.phone ?? undefined,
        whatsapp: b.whatsapp ?? undefined,
        address: b.address ?? undefined,
        deliveryFee: b.deliveryFee !== undefined ? Number(b.deliveryFee) || 0 : undefined,
        minOrder: b.minOrder !== undefined ? Number(b.minOrder) || 0 : undefined,
        warehouseId: b.warehouseId !== undefined ? b.warehouseId || null : undefined,
        isOpen: b.isOpen !== undefined ? !!b.isOpen : undefined,
        showOutOfStock: b.showOutOfStock !== undefined ? !!b.showOutOfStock : undefined,
        codEnabled: b.codEnabled !== undefined ? !!b.codEnabled : undefined,
        accentColor: b.accentColor ?? undefined,
        bgTheme: b.bgTheme ?? undefined,
        fontFamily: b.fontFamily ?? undefined,
      },
    })
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to update store settings' }, { status: 500 })
  }
}
