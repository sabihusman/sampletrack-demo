# SampleTrack — Lab Storage Management Simulator

An interactive hospital lab sample storage management tool that demonstrates how queueing theory explains capacity bottlenecks in clinical sample retention.

## Live Demo
[sampletrack-demo.vercel.app](https://sampletrack-demo.vercel.app)

## The Problem
Hospital labs store patient samples for up to 7 days for testing. But as bed counts grow while storage stays fixed, most samples get destroyed within 24–48 hours — before testing is complete.

## What This Tool Does
SampleTrack simulates a hospital lab's storage system and uses queueing theory to explain why the system breaks and what interventions fix it:

- **Little's Law** reveals that samples spend 93% of their time waiting, not being processed
- **Kingman's VUT equation** shows that high utilization (>80%) causes exponential queue growth
- **Scenario comparison** quantifies the impact of adding capacity vs reducing variability vs both

## Tech Stack
- React + Vite
- Single-page application — all simulation logic runs client-side
- No backend or database required

## Built For
MBA 8240 Operations & Supply Chain Management
University of Iowa, Tippie College of Business
