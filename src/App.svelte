<script lang="ts">
  import { Button } from '$lib/components/button';
  import { Slider } from '$lib/components/slider';
  import { Label } from '$lib/components/label';
  import { TabManager } from '$lib/TabManager';

  let { initialTabLimit = 10 } = $props();
  let tabLimit = $state(initialTabLimit);

  async function save() {
    await TabManager.setTabLimit(tabLimit);
  }
</script>

<main class="p-4">
  <h1 class="text-lg font-bold">TabGuard Pro</h1>

  <div class="my-4">
    <Label for="tab-limit">Tab Limit: {tabLimit}</Label>
    <Slider id="tab-limit" bind:value={tabLimit} min={1} max={50} step={1} />
  </div>

  <Button on:click={save}>Save</Button>
</main>
