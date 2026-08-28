import {
  FolderAddIcon,
  FolderEditIcon,
  FolderRemoveIcon,
  MoreVerticalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Progress } from "@workspace/ui/components/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export interface ProjectItem {
  id: string
  project: string
  date: string
  budget: string
  managerName: string
  managerHandle: string
  managerAvatar?: string
  progress: number
}

const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: "proj-1",
    project: "Web App Platform",
    date: "04 Jun 2026",
    budget: "$12,000",
    managerName: "Olivia Rhye",
    managerHandle: "olivia@example.com",
    managerAvatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces",
    progress: 60,
  },
  {
    id: "proj-2",
    project: "Admin Console Redesign",
    date: "09 Jan 2026",
    budget: "$8,000",
    managerName: "Barbara Steele",
    managerHandle: "barbara@example.com",
    managerAvatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=faces",
    progress: 30,
  },
  {
    id: "proj-3",
    project: "Campaign Hub",
    date: "15 Apr 2026",
    budget: "$15,000",
    managerName: "Leonard Gordon",
    managerHandle: "leonard@example.com",
    managerAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces",
    progress: 45,
  },
  {
    id: "proj-4",
    project: "Design System Tokens",
    date: "30 Mar 2026",
    budget: "$9,500",
    managerName: "Evelyn Pope",
    managerHandle: "evelyn@example.com",
    managerAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces",
    progress: 85,
  },
  {
    id: "proj-5",
    project: "Brand Assets Package",
    date: "23 Oct 2026",
    budget: "$7,000",
    managerName: "Tommy Garza",
    managerHandle: "tommy@example.com",
    managerAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces",
    progress: 72,
  },
]

export function TopProductsTable({
  projects = DEFAULT_PROJECTS,
}: {
  projects?: ProjectItem[]
}) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">
            Top Active Projects
          </CardTitle>
          <CardDescription>
            Performance and budget tracking across teams
          </CardDescription>
        </div>
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} size={16} />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search projects..." />
        </InputGroup>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 px-4">
                <Checkbox aria-label="Select all" />
              </TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead className="w-48">Progress</TableHead>
              <TableHead className="w-16 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="px-4">
                  <Checkbox aria-label={`Select ${item.project}`} />
                </TableCell>
                <TableCell>
                  <div className="font-medium text-card-foreground">
                    {item.project}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.date}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-medium">
                    {item.budget}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      {item.managerAvatar && (
                        <AvatarImage
                          src={item.managerAvatar}
                          alt={item.managerName}
                        />
                      )}
                      <AvatarFallback>
                        {item.managerName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium leading-none text-card-foreground">
                        {item.managerName}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.managerHandle}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Progress value={item.progress} className="h-1.5 flex-1" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.progress}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                        />
                      }
                    >
                      <HugeiconsIcon icon={MoreVerticalIcon} size={16} />
                      <span className="sr-only">Open menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2">
                        <HugeiconsIcon icon={FolderEditIcon} size={15} />
                        <span>Edit project</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <HugeiconsIcon icon={FolderAddIcon} size={15} />
                        <span>Add task</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" className="gap-2">
                        <HugeiconsIcon icon={FolderRemoveIcon} size={15} />
                        <span>Archive</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
