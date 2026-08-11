import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CustodyPanel } from '@/components/custody-panel'

export const dynamic = 'force-dynamic'

// الصفحة الشخصية للموظف: يطلب عهدة، يتابع حالتها، ويسجّل مصروفاته عليها بإثبات
export default async function MyCustodyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">عُهدتي</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          اطلب عهدة نقدية ← بعد اعتماد الإدارة بتتصرفلك من الخزنة ← سجّل مصروفاتك عليها بصورة الإيصال ← وترجّع المتبقي في التسوية
        </p>
      </div>
      <CustodyPanel mode="mine" />
    </div>
  )
}
