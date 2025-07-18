<script lang="ts">
	import { Button as ButtonPrimitive } from "bits-ui";
	import { buttonVariants, type Props, type Events } from ".";
	import { cn } from "$lib/utils";

	type $$Props = Props;
	type $$Events = Events;

	let {
		variant = "default",
		size = "default",
		builders = [],
		class: className,
		...rest
	} = $props();
</script>

<ButtonPrimitive.Root
	{builders}
	class={cn(buttonVariants({ variant, size, className }))}
	type="button"
	{...rest}
	on:click
	on:keydown
>
	<slot />
</ButtonPrimitive.Root>
