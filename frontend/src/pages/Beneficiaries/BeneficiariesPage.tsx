import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, Edit, Trash2 } from 'lucide-react'
import { apiService } from '../../services/api'
import { BeneficiaryGroup } from '../../types'
import { Labels } from '../../ui/labels'
import toast from 'react-hot-toast'

export default function BeneficiariesPage() {
    const [beneficiaries, setBeneficiaries] = useState<BeneficiaryGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadBeneficiaries()
    }, [])

    const loadBeneficiaries = async () => {
        setLoading(true)
        setError(null)

        try {
            const beneficiaryList = await apiService.getBeneficiaryGroups()
            setBeneficiaries(beneficiaryList)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load beneficiaries')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) {
            return
        }

        try {
            await apiService.deleteBeneficiaryGroup(id)
            setBeneficiaries(beneficiaries.filter(ben => ben.id !== id))
            toast.success('Beneficiary group deleted successfully')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete beneficiary group')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                    <p>Error loading beneficiaries: {error}</p>
                    <button
                        onClick={loadBeneficiaries}
                        className="mt-2 px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{Labels.beneficiaries}</h1>
                    <p className="text-gray-600">Manage beneficiary groups and demographics</p>
                </div>
                <Link
                    to="/beneficiaries/new"
                    className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Beneficiary Group</span>
                </Link>
            </div>

            {/* Beneficiaries List */}
            {beneficiaries.length === 0 ? (
                <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No beneficiary groups found</h3>
                    <p className="text-gray-600 mb-4">
                        Get started by adding your first beneficiary group.
                    </p>
                    <Link
                        to="/beneficiaries/new"
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Beneficiary Group</span>
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Data Points
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {beneficiaries.map((beneficiary) => (
                                    <tr key={beneficiary.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {beneficiary.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500 max-w-xs truncate">
                                                {beneficiary.description || '—'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {/* TODO: Show actual data point count */}
                                            —
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <Link
                                                    to={`/beneficiaries/${beneficiary.id}`}
                                                    className="text-primary-600 hover:text-primary-900"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(beneficiary.id, beneficiary.name)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
