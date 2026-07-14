{{/*
Base name, respecting nameOverride.
*/}}
{{- define "soc-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully qualified app name.
*/}}
{{- define "soc-platform.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Chart name + version, for the "helm.sh/chart" label.
*/}}
{{- define "soc-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels, applied to every resource this chart creates.
*/}}
{{- define "soc-platform.labels" -}}
helm.sh/chart: {{ include "soc-platform.chart" . }}
{{ include "soc-platform.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels, shared between a Deployment's pod template and its Service —
kept separate from soc-platform.labels since selectors must never change
across releases (unlike version/managed-by, which do).
*/}}
{{- define "soc-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "soc-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Per-component labels/selectors (api / worker / web) — every workload's own
identity, layered on top of the common ones above.
*/}}
{{- define "soc-platform.componentLabels" -}}
{{ include "soc-platform.labels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "soc-platform.componentSelectorLabels" -}}
{{ include "soc-platform.selectorLabels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Service account name.
*/}}
{{- define "soc-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "soc-platform.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Resolves an image reference for a given component key (api|worker|web).
*/}}
{{- define "soc-platform.image" -}}
{{- $registry := .root.Values.image.registry -}}
{{- $repo := index .root.Values.image.repository .component -}}
{{- $tag := .root.Values.image.tag | default .root.Chart.AppVersion -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- else -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end -}}

{{/*
Name of the Secret this release reads from — either a pre-existing one the
operator manages, or the one this chart itself creates from .Values.secret.values.
*/}}
{{- define "soc-platform.secretName" -}}
{{- .Values.secret.existingSecret | default (printf "%s-secrets" (include "soc-platform.fullname" .)) -}}
{{- end -}}
