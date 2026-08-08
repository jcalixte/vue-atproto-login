<script setup lang="ts">
import AtprotoHandleInput from "../AtprotoHandleInput.vue"
import AtprotoLogin from "../AtprotoLogin.vue"
</script>

<!--
  A consumer with `<style scoped>`. Vue only writes the scope attribute onto
  elements it considers roots — see AtprotoHandleInput.spec.ts.
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
