/* eslint-disable no-async-promise-executor */
import { FieldArray, FormikProvider, useFormik } from "formik";
import { Accordion, Button, Container, Form, Row, Col } from "react-bootstrap";
import { useMemo, useRef, useState } from "react";
import * as yup from "yup";
import Icon from "@mdi/react";
import {
  mdiClose,
  mdiContentCopy,
  mdiFilePdfBox,
  mdiFileWord,
  mdiNoteEditOutline,
} from "@mdi/js";
import { toast } from "react-toastify";

const uploadUrl = `${import.meta.env.VITE_APP_BACKEND_URL}/upload`; // Your server endpoint
const summaryUrl = `${import.meta.env.VITE_APP_BACKEND_URL}/summary`; // Your server endpoint

function App() {
  const [isLoading, setIsLoading] = useState();

  const paragraphRef = useRef(null);
  const transRef = useRef("");
  const fileInputRef = useRef("");
  const transcription = useMemo(() => {
    return transRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transRef.current]);

  const setTranscription = (data) => {
    transRef.current = data;
  };

  const [summary, setSummary] = useState("");
  const [infoText, setInfoText] = useState("");
  const [audioBlob, setAudioBlob] = useState();

  const formik = useFormik({
    initialValues: {
      title: "",
      attendees: [{ attendee: "" }, { attendee: "" }],
      briefSummary: "",
      // audioFile: "",
    },
    validationSchema: yup.object().shape({
      //  audioFile: yup.required(),
    }),
    onSubmit: async (values) => {
      const payload = {
        ...values,
        attendees: values.attendees.filter((el) => el.attendee),
      };
      // console.log(payload);
      postTo({ payload });
    },
    onReset: () => {
      setAudioBlob();
      fileInputRef.current.value = "";
    },
  });

  const joinWithAnd = (arr) => {
    return arr.length < 2
      ? arr.join("")
      : arr.length === 2
      ? arr.join(" and ")
      : arr.slice(0, -1).join(", ") + ", and " + arr.slice(-1);
  };

  const ArticleHeader = () => {
    return (
      <>
        {formik.values.title && (
          <h2 className="text-center mb-4">{formik.values.title}</h2>
        )}

        {formik.values?.attendees?.every((el) => el?.attendee) && (
          <p className="mb-0">
            <span className="fw-bold">Attendees:</span>{" "}
            {joinWithAnd(
              formik.values?.attendees
                .map((el) => el?.attendee)
                .filter((el) => el)
            )}
          </p>
        )}

        {formik.values.briefSummary && (
          <p style={{ whiteSpace: "pre-wrap" }}>
            <span className="fw-bold">Brief Summary:</span>{" "}
            {formik.values.briefSummary}
          </p>
        )}
      </>
    );
  };

  function uploadFile({ payload }) {
    return new Promise(async (resolve, reject) => {
      try {
        const file = payload.audioFile;
        const chunkSize = 1024 * 1024 * 20; // 20MB per chunk
        const totalChunks = Math.ceil(file.size / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(file.size, start + chunkSize);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("chunkIndex", i);
          formData.append("totalChunks", totalChunks);
          formData.append("fileName", file.name);
          formData.append("uniqueId", `${Math.random() * Date.now()}`);

          try {
            const response = await fetch(uploadUrl, {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              throw new Error(
                `Error uploading chunk ${i}: ${response.statusText}, check connection and try again`
              );
            }

            const data = await response.json();
            setTranscription(`${transRef.current || ""} ${data.transcription}`);
            console.log(`Uploaded chunk ${i + 1} of ${totalChunks}`);
          } catch (error) {
            throw new Error(`Upload failed: ${error.message}`);
          }
        }

        // alert(transRef.current);
        resolve();
      } catch (error) {
        toast.error(`Error: ${error?.message}`);
        console.log(error);
        reject(error);
      }
    });
  }

  const summarize = ({ transcribedText: transcription }) => {
    return new Promise(async (resolve, reject) => {
      try {
        const summaryformData = new FormData();
        summaryformData.append("transcription", transcription);
        const response = await fetch(summaryUrl, {
          method: "POST",
          body: summaryformData,
        });

        if (!response.ok) {
          throw new Error(`Summary Error`);
        }

        const data = await response.json();
        setSummary(data.summary);
        resolve();
      } catch (error) {
        toast.error(`Error: ${error?.message}`);
        console.log(error);
        reject(error);
      }
    });
  };

  const postTo = async ({ payload }) => {
    try {
      setIsLoading(true);
      if (!payload.audioFile) {
        toast.error("Please select a file first.");
        return;
      }

      setTranscription("");
      setSummary("");

      setInfoText("Uploading and transcribing...");

      await uploadFile({ payload });

      setInfoText("Summarizing...");

      await summarize({ transcribedText: transRef.current });

      setInfoText("✅ Done... 😃");

      setTimeout(() => {
        paragraphRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 500);
    } catch (err) {
      console.log(err);
      setInfoText("");
    } finally {
      setIsLoading(false);
    }
  };

  async function copyContent(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Content copied to clipboard");
      /* Resolved - text copied to clipboard successfully */
    } catch (err) {
      console.error("Failed to copy: ", err);
      /* Rejected - text failed to copy to the clipboard */
    }
  }

  const onFileSelected = async (event) => {
    const selectedFile = event.target?.files[0];
    if (!selectedFile) return;

    formik.setFieldValue("audioFile", selectedFile);

    const reader = new FileReader();
    reader.readAsArrayBuffer(selectedFile);
    reader.onload = () => {
      const blob = new Blob([reader.result], {
        type: selectedFile.type,
      });

      setAudioBlob(blob);
    };
  };

  return (
    <div className="my-4">
      <Container className="p-4 shadow-sm rounded bg-white mb-5 border">
        <FormikProvider value={formik}>
          <Form noValidate onSubmit={formik.handleSubmit}>
            <h1 className="text-center h4 fw-semibold d-flex gap-2 align-items-center justify-content-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="24"
                height="24"
              >
                <title>account-tie-voice</title>
                <path
                  d="M16.75 4.36C18.77 6.56 18.77 9.61 16.75 11.63L15.07 9.94C15.91 8.76 15.91 7.23 15.07 6.05L16.75 4.36M20.06 1C24 5.05 23.96 11.11 20.06 15L18.43 13.37C21.2 10.19 21.2 5.65 18.43 2.63L20.06 1M9 4C11.2 4 13 5.79 13 8S11.2 12 9 12 5 10.21 5 8 6.79 4 9 4M13 14.54C13 15.6 12.71 18.07 10.8 20.83L10 16L10.93 14.12C10.31 14.05 9.66 14 9 14S7.67 14.05 7.05 14.12L8 16L7.18 20.83C5.27 18.07 5 15.6 5 14.54C2.6 15.24 .994 16.5 .994 18V22H17V18C17 16.5 15.39 15.24 13 14.54Z"
                  fill="#3b59fe"
                />
              </svg>{" "}
              AI Audio Transcribe
            </h1>
            <fieldset /* disabled="disabled" */>
              <Form.Group className="mb-3">
                <Form.Label>Title</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter Title"
                  name="title"
                  value={formik.values.title}
                  onChange={formik.handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3 col-md-8">
                <Form.Label>Attendees</Form.Label>
                <FieldArray
                  name="attendees"
                  render={(arrayHelpers) => (
                    <>
                      {formik.values.attendees.map((el, index) => (
                        <div key={index} className="d-flex gap-2 mb-3">
                          <Form.Control
                            placeholder="Enter Attendee"
                            name={`attendees[${index}].attendee`}
                            value={formik.values.attendees[index].attendee}
                            onChange={formik.handleChange}
                          />
                          <Button
                            variant=""
                            onClick={() => arrayHelpers.remove(index)}
                            size="sm"
                          >
                            <Icon path={mdiClose} size={1} />
                          </Button>
                        </div>
                      ))}

                      <div className="d-flex justify-content-start px-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="light"
                          onClick={() =>
                            arrayHelpers.push({
                              attendee: "",
                            })
                          }
                        >
                          + Add
                        </Button>
                      </div>
                    </>
                  )}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Brief Summary</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Enter Brief Summary"
                  name="briefSummary"
                  value={formik.values.briefSummary}
                  onChange={formik.handleChange}
                />
              </Form.Group>

              <Form.Group controlId="formFile" className="mb-3 w-100">
                <Form.Label>Upload Audio File</Form.Label>
                <Row className="align-items-center mt-n2">
                  <Col>
                    <Form.Control
                      type="file"
                      accept="audio/*"
                      onChange={(e) => onFileSelected(e)}
                      ref={fileInputRef}
                    />
                  </Col>
                  <Col>
                    <div
                      className="d-flex"
                      style={{ visibility: audioBlob ? "visible" : "hidden" }}
                    >
                      <audio
                        src={audioBlob ? URL.createObjectURL(audioBlob) : ""}
                        controls
                        className={``}
                      />
                      <Button
                        variant=""
                        onClick={() => {
                          fileInputRef.current.value = "";
                          setAudioBlob();
                        }}
                        size="sm"
                      >
                        <Icon path={mdiClose} size={1} />
                      </Button>
                    </div>
                  </Col>{" "}
                </Row>
              </Form.Group>

              <div className="d-flex gap-3 pt-3 justify-content-between align-items-center">
                <div>
                  <p>{infoText || "..."}</p>
                </div>
                <div className="d-flex gap-3 pt-3 justify-content-end">
                  <Button
                    type="button"
                    variant="outline-primary"
                    disabled={isLoading}
                    onClick={() => formik.resetForm()}
                  >
                    Clear
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Please wait..." : "Submit"}
                  </Button>
                </div>
              </div>
            </fieldset>
          </Form>
        </FormikProvider>
      </Container>

      <Container
        className="p-0 shadow-sm rounded bg-white mb-5"
        ref={paragraphRef}
      >
        <Accordion defaultActiveKey={["0", "1"]} alwaysOpen>
          <Accordion.Item eventKey="0">
            <Accordion.Header>Transcription</Accordion.Header>
            <Accordion.Body className="position-relative" bsPrefix="p-0">
              {transcription && (
                <div className="position-absolute top-0 end-0 d-flex p-1">
                  <Button
                    className="text-dark"
                    onClick={() => copyContent(transcription)}
                    variant=""
                    title="Copy"
                    size="sm"
                  >
                    <Icon path={mdiContentCopy} size={1} />
                  </Button>
                  <Button
                    className="text-danger"
                    onClick={() => toast.info("PDF: Not Available")}
                    variant=""
                    title="Export PDF"
                    size="sm"
                  >
                    <Icon path={mdiFilePdfBox} size={1} />
                  </Button>
                  <Button
                    className="text-primary"
                    onClick={() => toast.info("Word Doc: Not Available")}
                    variant=""
                    title="Export Docx"
                    size="sm"
                  >
                    <Icon path={mdiFileWord} size={1} />
                  </Button>
                  <Button
                    className="text-dark"
                    onClick={() => toast.info("Edit: Not Available")}
                    variant=""
                    title="Edit"
                    size="sm"
                  >
                    <Icon path={mdiNoteEditOutline} size={1} />
                  </Button>
                </div>
              )}

              <div className="article">
                {transcription ? (
                  <>
                    <ArticleHeader />
                    <p>{transcription}</p>
                  </>
                ) : (
                  "..."
                )}{" "}
              </div>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="1">
            <Accordion.Header>Summary</Accordion.Header>
            <Accordion.Body className="position-relative" bsPrefix="p-0">
              {summary && (
                <div className="position-absolute top-0 end-0 d-flex p-1">
                  <Button
                    className="text-dark"
                    onClick={() => copyContent(summary)}
                    variant=""
                    title="Copy"
                    size="sm"
                  >
                    <Icon path={mdiContentCopy} size={1} />
                  </Button>
                  <Button
                    className="text-danger"
                    onClick={() => toast.info("PDF: Not Available")}
                    variant=""
                    title="Export PDF"
                    size="sm"
                  >
                    <Icon path={mdiFilePdfBox} size={1} />
                  </Button>
                  <Button
                    className="text-primary"
                    onClick={() => toast.info("Word Doc: Not Available")}
                    variant=""
                    title="Export Docx"
                    size="sm"
                  >
                    <Icon path={mdiFileWord} size={1} />
                  </Button>
                  <Button
                    className="text-dark"
                    onClick={() => toast.info("Edit: Not Available")}
                    variant=""
                    title="Edit"
                    size="sm"
                  >
                    <Icon path={mdiNoteEditOutline} size={1} />
                  </Button>
                </div>
              )}

              <div className="article">
                {summary ? (
                  <>
                    <ArticleHeader />
                    <p>{summary}</p>
                  </>
                ) : (
                  "..."
                )}{" "}
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Container>
    </div>
  );
}

export default App;
