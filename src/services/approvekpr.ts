// src/services/approvekpr.ts
import coreApi from "@/lib/coreApi"

export type Pengajuan = {
  id: number
  applicantName: string
  applicantEmail: string
  applicantPhone: string | null
  aplikasiKode: string
  namaProperti: string
  alamat: string
  harga: number
  tanggal: string
  jenis: string
  status: string
}

// 🔹 Ambil semua pengajuan dengan status SUBMITTED
export async function getAllPengajuanByUser() {
  try {
    const res = await coreApi.get("/kpr-applications/admin/in-progress")

    const json = res.data
    const data: Pengajuan[] =
      json.data?.data ?? json.data ?? []

    return data
  } catch (error) {
    console.error("❌ Error fetching pengajuan (submitted):", error)
    return []
  }
}

// 🔹 Ambil semua pengajuan dengan status selain SUBMITTED
export async function getAllNonSubmittedPengajuan() {
  try {
    const res = await coreApi.get("/kpr-applications/admin/history", {
    })

    const json = res.data
    const data: Pengajuan[] =
      json.data?.data ?? json.data ?? []

    console.log("📦 Pengajuan non-submitted:", data.length)
    return data
  } catch (error) {
    console.error("❌ Error fetching pengajuan (non-submitted):", error)
    return []
  }
}

// 🔹 Ambil detail pengajuan KPR berdasarkan ID
export async function getPengajuanDetail(id: number) {
  try {
    const res = await coreApi.get(`/kpr-applications/${id}`)
    return res.data?.data // langsung ambil field "data" dari response
  } catch (error) {
    console.error(`❌ Error fetching pengajuan detail for ID ${id}:`, error)
    return null
  }
}

// 🔹 Assign admin verifikator untuk sebuah aplikasi
export type AssignAdminsPayload = {
  applicationId: number
  firstApprovalId: number
  secondApprovalId: number
}

export async function assignAdmins(payload: AssignAdminsPayload) {
  try {
    const res = await coreApi.post("/kpr-applications/admin/assign", payload)
    // Standarisasi hasil
    return {
      success: Boolean(res.data?.success ?? true),
      data: res.data?.data ?? null,
      message: res.data?.message ?? "Assigned",
    }
  } catch (err: any) {
    if (err.response) {
      console.error("❌ Assign admins failed:", err.response.data)
    } else {
      console.error("❌ Assign admins error:", err)
    }
    throw err
  }
}

// 🔹 Ambil seluruh approver untuk pengisian select
export type Approver = {
  id: number
  fullName: string
  email?: string
  roleName?: string
  status?: string
}

export async function getApprovers(): Promise<Approver[]> {
  try {
    const res = await coreApi.get("/admin/approver")
    const list = Array.isArray(res.data?.data) ? res.data.data : []
    return list as Approver[]
  } catch (error) {
    console.error("❌ Error fetching approvers:", error)
    return []
  }
}

