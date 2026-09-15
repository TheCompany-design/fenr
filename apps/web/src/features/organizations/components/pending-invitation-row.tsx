import { Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { TableCell, TableRow } from "@workspace/ui/components/table"

export interface PendingInvitationRowProps {
  invitation: {
    id: string
    email: string
    role: string
    expiresAt: Date
    status: string
  }
  isBusy: boolean
  onCancelInvitation: (invitationId: string, email: string) => void
}

export function PendingInvitationRow({
  invitation,
  isBusy,
  onCancelInvitation,
}: PendingInvitationRowProps) {
  return (
    <TableRow key={invitation.id}>
      <TableCell className="ps-4 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span>{invitation.email}</span>
          <Badge
            variant="outline"
            className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground px-1.5 py-0"
          >
            pending
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-xs font-normal">
          {invitation.role}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(invitation.expiresAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </TableCell>
      <TableCell className="pe-4 text-right">
        {isBusy ? (
          <HugeiconsIcon
            icon={Loading03Icon}
            size={16}
            className="animate-spin text-muted-foreground ml-auto"
          />
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Revoke invitation for ${invitation.email}`}
            onClick={() => onCancelInvitation(invitation.id, invitation.email)}
            className="cursor-pointer text-muted-foreground hover:text-destructive"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
