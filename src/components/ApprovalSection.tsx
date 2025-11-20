"use client"

import { useEffect, useState } from "react"
import { getAllNonSubmittedPengajuan, Pengajuan } from "@/services/approvekpr"
import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"

import { customers } from "@/components/data/history"
import { properties } from "@/components/data/properties"

// Lazy load dialog agar tidak berat di awal
const ViewApprovalDetails = React.lazy(() => import("@/components/dialogs/ViewApprovalDetails"))

type HistoryRow = {
  id: string
  application_id: string
  customer_name: string
  property_name: string
  address: string
  price: number
  status:
    | "PROPERTY_APPRAISAL"
    | "CREDIT_ANALYSIS"
    | "FINAL_APPROVAL"
    | "ACCEPTED"
    | "REJECTED"
    | string // fallback biar gak error kalau ada status baru
  approval_date: string
}

function formatDate(dateString: string) {
  if (!dateString) return "-"
  const d = new Date(dateString)
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function ApprovalHistory() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [filter, setFilter] = React.useState("")
  const [selectedRow, setSelectedRow] = React.useState<HistoryRow | null>(null)
  const [openDialog, setOpenDialog] = React.useState(false)
  const [data, setData] = useState<Pengajuan[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      try {
        const result = await getAllNonSubmittedPengajuan()
        if (active) setData(result || [])
      } catch (err) {
        console.error("❌ Gagal memuat data approval history:", err)
        if (active) setData([])
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchData()
    return () => { active = false }
  }, [])

  // 🔗 Gabungkan data customer dan property
  // const joinedData: HistoryRow[] = React.useMemo(() => {
  //   return customers.map((cust) => {
  //     const prop = properties.find((p) => p.id === cust.property_id)
  //     return {
  //       id: cust.id,
  //       application_id: cust.application_id || `APP-${cust.id.padStart(3, "0")}`,
  //       customer_name: cust.name,
  //       property_name: prop?.title || "Properti tidak ditemukan",
  //       address: prop ? `${prop.address}, ${prop.city}` : "-",
  //       price: prop?.price || 0,
  //       status: cust.status,
  //       approval_date: cust.approval_date,
  //     }
  //   })
  // }, [])

  // 🔹 Data hasil API (kecuali SUBMITTED)
  const joinedData: HistoryRow[] = React.useMemo(() => {
    return data.map((item) => ({
      id: item.id.toString(),
      application_id: item.aplikasiKode,
      customer_name: item.applicantName,
      property_name: item.namaProperti,
      address: item.alamat,
      price: item.harga,
      status: item.status, // nanti di-mapping di kolom
      approval_date: item.tanggal,
    }))
  }, [data])


  const filteredData = React.useMemo(() => {
    return joinedData.filter((item) =>
      item.customer_name.toLowerCase().includes(filter.toLowerCase())
    )
  }, [filter, joinedData])

  // ===== Kolom =====
  const columns: ColumnDef<HistoryRow>[] = [
    {
      id: "no",
      header: () => <div className="font-semibold text-center w-10">No</div>,
      cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
      accessorKey: "application_id",
      header: () => <div className="font-semibold">ID Pengajuan</div>,
      cell: ({ row }) => <div className="font-medium">{row.getValue("application_id")}</div>,
    },
    {
      accessorKey: "customer_name",
      header: () => <div className="font-semibold">Nama Customer</div>,
      cell: ({ row }) => <div>{row.getValue("customer_name")}</div>,
    },
    {
      accessorKey: "property_name",
      header: () => <div className="font-semibold">Nama Properti</div>,
      cell: ({ row }) => <div>{row.getValue("property_name")}</div>,
    },
    {
      accessorKey: "address",
      header: () => <div className="font-semibold">Alamat</div>,
      cell: ({ row }) => <div>{row.getValue("address")}</div>,
    },
    {
      accessorKey: "price",
      header: () => <div className="font-semibold">Harga</div>,
      cell: ({ row }) => {
        const price = row.getValue("price") as number
        return (
          <div className="font-medium">
            {price > 0 ? `Rp ${price.toLocaleString("id-ID")}` : "-"}
          </div>
        )
      },
    },
    {
      accessorKey: "approval_date",
      header: () => <div className="font-semibold">Tanggal</div>,
      cell: ({ row }) => (
        <div className="">{formatDate(row.getValue("approval_date") as string)}</div>
      ),
    },
    {
      accessorKey: "status",
      header: () => <div className="font-semibold">Status</div>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        const getStatusConfig = (s: string) => {
          switch (s?.toUpperCase()) {
            case "PROPERTY_APPRAISAL":
              return { text: "Property Appraisal", bgColor: "bg-purple-200 hover:bg-purple-300", textColor: "text-purple-900", dotColor: "bg-purple-700" }
            case "DRAFT":
              return { text: "Draft", bgColor: "bg-gray-200 hover:bg-gray-300", textColor: "text-gray-900", dotColor: "bg-gray-700" }
            case "SUBMITTED":
              return { text: "Assigned", bgColor: "bg-blue-200 hover:bg-blue-300", textColor: "text-blue-900", dotColor: "bg-blue-700" }
            case "UNDER_REVIEW":
              return { text: "Under Review", bgColor: "bg-yellow-200 hover:bg-yellow-300", textColor: "text-yellow-900", dotColor: "bg-yellow-700" }
            case "APPROVED":
            case "APPROVE":
              return { text: "Approved", bgColor: "bg-green-200 hover:bg-green-300", textColor: "text-green-900", dotColor: "bg-green-700" }
            case "REJECTED":
            case "REJECT":
              return { text: "Rejected", bgColor: "bg-rose-200 hover:bg-rose-300", textColor: "text-rose-900", dotColor: "bg-rose-700" }
            case "CANCELLED":
              return { text: "Cancelled", bgColor: "bg-red-200 hover:bg-red-300", textColor: "text-red-900", dotColor: "bg-red-700" }
            case "DOCUMENT_VERIFICATION":
              return { text: "Document Verification", bgColor: "bg-indigo-200 hover:bg-indigo-300", textColor: "text-indigo-900", dotColor: "bg-indigo-700" }
            case "CREDIT_ANALYSIS":
              return { text: "Credit Analysis", bgColor: "bg-teal-200 hover:bg-teal-300", textColor: "text-teal-900", dotColor: "bg-teal-700" }
            case "APPROVAL_PENDING":
              return { text: "Approval Pending", bgColor: "bg-orange-200 hover:bg-orange-300", textColor: "text-orange-900", dotColor: "bg-orange-700" }
            case "DISBURSED":
              return { text: "Disbursed", bgColor: "bg-emerald-200 hover:bg-emerald-300", textColor: "text-emerald-900", dotColor: "bg-emerald-700" }
            default:
              return { text: s || "Unknown", bgColor: "bg-slate-200 hover:bg-slate-300", textColor: "text-slate-900", dotColor: "bg-slate-700" }
          }
        }

        const config = getStatusConfig(status)
        return (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedRow(row.original)
              setOpenDialog(true)
            }}
            className={`flex items-center gap-2 px-3 py-1 rounded-md font-semibold shadow-sm ${config.bgColor} ${config.textColor}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${config.dotColor}`} />
            {config.text}
          </Button>
        )
      },
    },

  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    state: { sorting, pagination },
  })

  return (
    <div className="w-full">
      {/* --- Header Filter --- */}
      <div className="flex items-center justify-between py-4">
        <h2 className="text-lg font-semibold">Approval History</h2>
        <Input
          placeholder="Cari nama customer..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* --- Table --- */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/80">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          {/* <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Tidak ada data approval.
                </TableCell>
              </TableRow>
            )}
          </TableBody> */}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Memuat data riwayat approval...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No Results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>

        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>

      {/* --- Dialog Detail --- */}
      <React.Suspense fallback={null}>
        {selectedRow && (
          <ViewApprovalDetails
            open={openDialog}
            onOpenChange={setOpenDialog}
            data={selectedRow}
          />
        )}
      </React.Suspense>
    </div>
  )
}
