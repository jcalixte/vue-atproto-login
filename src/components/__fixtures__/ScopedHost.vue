<script setup lang="ts">
import AtprotoHandleInput from "../AtprotoHandleInput.vue"
import AtprotoLogin from "../AtprotoLogin.vue"
</script>

<!--
  A consumer with `<style scoped>`, which is how an app styles a library
  component's internals. Vue only writes the scope attribute below onto elements
  it considers roots, so this fixture exists to pin down which ones actually get
  it — see AtprotoHandleInput.spec.ts.
-->
<template>
  <div class="host">
    <AtprotoLogin :debounce="0" />
    <AtprotoHandleInput :debounce="0" />
  </div>
</template>

<style scoped>
.host {
  position: relative;
}
</style>
