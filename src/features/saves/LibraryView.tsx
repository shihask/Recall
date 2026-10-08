import { Plus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorNotice, PageHeader } from '@/components/ui/misc'
import { errorMessage } from '@/services/supabase/errors'
import type { ListParams } from '@/types/domain'
import { useItems } from './hooks'
import { ItemList, ItemListSkeleton, LayoutToggle } from './ItemList'
import { useSaveSheet } from './save-sheet-context'
import { useCardLayout } from './useCardLayout'

interface LibraryViewProps {
  params: ListParams
  title: string
  description?: string
  headerActions?: ReactNode
  /** Above the title (e.g. a breadcrumb). */
  eyebrow?: ReactNode
  /** Between the header and the items (e.g. sub-collections). */
  intro?: ReactNode
  empty: { icon: LucideIcon; title: string; description: string; showSave?: boolean; extraAction?: ReactNode }
  /** Prefill for the empty-state Save button (e.g. the current collection). */
  saveCollectionId?: string
}

export function LibraryView({ params, title, description, headerActions, eyebrow, intro, empty, saveCollectionId }: LibraryViewProps) {
  const [layout, setLayout] = useCardLayout()
  const { openSave } = useSaveSheet()
  const query = useItems(params)

  return (
    <div>
      {eyebrow}
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            <LayoutToggle value={layout} onChange={setLayout} />
          </>
        }
      />
      {intro}
      {query.isPending ? (
        <ItemListSkeleton layout={layout} />
      ) : query.isError ? (
        <ErrorNotice message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          action={
            (empty.showSave || empty.extraAction) && (
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                {empty.showSave && (
                  <Button onClick={() => openSave(saveCollectionId ? { collectionId: saveCollectionId } : undefined)}>
                    <Plus className="h-4 w-4" aria-hidden /> Save something
                  </Button>
                )}
                {empty.extraAction}
              </div>
            )
          }
        />
      ) : (
        <ItemList
          items={query.data}
          layout={layout}
          hasMore={query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      )}
    </div>
  )
}
