const normalizeList = (value) => (Array.isArray(value) ? value : []);

const normalizeId = (value) => String(value ?? '').trim();

export const filterRunnerScreenshotArtifactsForApp = ({ artifacts, expectedAppId }) => {
    const normalizedExpectedAppId = normalizeId(expectedAppId);
    const validArtifacts = [];
    const mismatchedArtifacts = [];

    for (const artifact of normalizeList(artifacts)) {
        const artifactAppId = normalizeId(artifact?.app_id);
        if (normalizedExpectedAppId && artifactAppId !== normalizedExpectedAppId) {
            mismatchedArtifacts.push(artifact);
            continue;
        }
        validArtifacts.push(artifact);
    }

    return {
        validArtifacts,
        mismatchedArtifacts,
    };
};

export const validatePersistedRunnerScreenshotArtifacts = ({
    shots,
    artifactIdentities,
    expectedAppId,
}) => {
    const normalizedExpectedAppId = normalizeId(expectedAppId);
    const artifactById = new Map(
        normalizeList(artifactIdentities).map((artifact) => [normalizeId(artifact?.id), artifact])
    );
    const artifactValidityById = {};
    const invalidShots = [];

    for (const shot of normalizeList(shots)) {
        const artifactId = normalizeId(shot?.artifact_id);
        if (!artifactId) continue;

        const artifact = artifactById.get(artifactId);
        const importedFromJobId = normalizeId(shot?.imported_from_job_id);
        const artifactAppId = normalizeId(artifact?.app_id);
        const artifactJobId = normalizeId(artifact?.job_id);
        const isValid =
            Boolean(artifact) &&
            artifactAppId === normalizedExpectedAppId &&
            (!importedFromJobId || artifactJobId === importedFromJobId);

        artifactValidityById[artifactId] = isValid;
        if (isValid) continue;

        invalidShots.push({
            artifactId,
            importedFromJobId,
        });
    }

    return {
        artifactValidityById,
        invalidShots,
    };
};
