import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CharacterCounter } from "@/components/composer/CharacterCounter";

export function PostEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  charLimit,
}: {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  charLimit: number;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="post-title">Title (internal only)</Label>
        <Input
          id="post-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Product launch announcement"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="post-content">Content</Label>
          <CharacterCounter current={content.length} max={charLimit} />
        </div>
        <Textarea
          id="post-content"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="What do you want to share?"
          className="min-h-[160px]"
        />
      </div>
    </div>
  );
}
