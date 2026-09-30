import NameFormModal from './NameFormModal'

interface Props {
    open: boolean
    mode: 'create' | 'edit'
    initialName?: string
    onCancel: () => void
    onSubmit: (values: { name: string }) => void
    validateName?: (name: string) => string | null
}

export default function SubcategoryFormModal({
    open,
    mode,
    initialName = '',
    onCancel,
    onSubmit,
    validateName,
}: Props) {
    return (
        <NameFormModal
            open={open}
            eyebrow={mode === 'create' ? 'New' : 'Edit'}
            title="Subcategory"
            initialName={initialName}
            placeholder="e.g. ROW 1, Common"
            submitLabel={mode === 'create' ? 'Create' : 'Save'}
            onCancel={onCancel}
            onSubmit={onSubmit}
            validateName={validateName}
        />
    )
}
